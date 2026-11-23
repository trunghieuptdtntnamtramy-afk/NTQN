import React, { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Lightbulb,
  LogOut,
  PenTool,
  SearchCheck,
  X,
} from "lucide-react";
import {
  db,
  ensureUserProfile,
  googleSignIn,
  initAuth,
  logout,
  OperationType,
  handleFirestoreError,
  testConnection,
} from "./lib/firebase";
import {
  createStudyDoc,
  createStudyForm,
  createStudyPlanSheet,
  createStudyPresentation,
  sendGmailReport,
} from "./lib/workspace";
import { ConfirmModal, type ConfirmDialogState } from "./components/ConfirmModal";
import { GoogleSignInButton } from "./components/GoogleSignInButton";
import { StudyPlanModule } from "./components/StudyPlanModule";
import { ThinkAndCoachModule } from "./components/ThinkAndCoachModule";
import { FactCheckAndTestModule } from "./components/FactCheckAndTestModule";
import { SurveyAndStatsModule } from "./components/SurveyAndStatsModule";
import { WorkspaceHubModule } from "./components/WorkspaceHubModule";
import {
  CONFIDENCE_LEVELS,
  SURVEY_QUESTIONS,
  type FactCheckEntry,
  type ModuleId,
  type SelfTestEntry,
  type StudyTask,
  type SurveyResponse,
  type ThinkEntry,
} from "./types/edu";

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>("home");
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Domain state (Firestore-backed when authenticated, local preview state when signed out)
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [thinkEntries, setThinkEntries] = useState<ThinkEntry[]>([]);
  const [factChecks, setFactChecks] = useState<FactCheckEntry[]>([]);
  const [selfTests, setSelfTests] = useState<SelfTestEntry[]>([]);
  const [surveys, setSurveys] = useState<SurveyResponse[]>([]);

  // Global feedback toast & Workspace confirmation modal
  const [toast, setToast] = useState<{
    message: string;
    linkUrl?: string;
    linkLabel?: string;
    isError?: boolean;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    testConnection();
    const unsubscribe = initAuth(async (firebaseUser, token) => {
      setUser(firebaseUser);
      setAccessToken(token);
      setAuthReady(true);
      if (firebaseUser) {
        try {
          await ensureUserProfile(firebaseUser);
        } catch (err) {
          console.error("Failed to ensure user profile:", err);
        }
      } else {
        setTasks([]);
        setThinkEntries([]);
        setFactChecks([]);
        setSelfTests([]);
        setSurveys([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Attach Firestore real-time listeners only when auth is ready & user is signed in
  useEffect(() => {
    if (!authReady || !user) return;

    const getMillis = (ts: unknown): number => {
      if (ts && typeof ts === "object" && "toMillis" in ts && typeof (ts as { toMillis: () => number }).toMillis === "function") {
        return (ts as { toMillis: () => number }).toMillis();
      }
      return 0;
    };

    const uid = user.uid;
    const unsubTasks = onSnapshot(
      query(collection(db, "studyTasks"), where("userId", "==", uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StudyTask, "id">),
        }));
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setTasks(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "studyTasks")
    );

    const unsubThink = onSnapshot(
      query(collection(db, "thinkEntries"), where("userId", "==", uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ThinkEntry, "id">),
        }));
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setThinkEntries(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "thinkEntries")
    );

    const unsubFacts = onSnapshot(
      query(collection(db, "factChecks"), where("userId", "==", uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<FactCheckEntry, "id">),
        }));
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setFactChecks(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "factChecks")
    );

    const unsubTests = onSnapshot(
      query(collection(db, "selfTests"), where("userId", "==", uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SelfTestEntry, "id">),
        }));
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setSelfTests(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "selfTests")
    );

    const unsubSurveys = onSnapshot(
      query(collection(db, "surveys"), where("userId", "==", uid)),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SurveyResponse, "id">),
        }));
        items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setSurveys(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, "surveys")
    );

    return () => {
      unsubTasks();
      unsubThink();
      unsubFacts();
      unsubTests();
      unsubSurveys();
    };
  }, [authReady, user]);

  const navigateTo = (module: ModuleId) => {
    setActiveModule(module);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAccessToken(result.accessToken);
      await ensureUserProfile(result.user);
      setToast({
        message: `Xin chào ${result.user.displayName || result.user.email}! Đã kết nối tài khoản và Google Workspace.`,
      });
    } catch (err) {
      setToast({
        message:
          err instanceof Error
            ? `Đăng nhập chưa hoàn tất: ${err.message}`
            : "Không thể đăng nhập bằng Google.",
        isError: true,
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setToast({ message: "Đã đăng xuất khỏi EDU SMART." });
  };

  const requestConfirm = (dialog: Omit<ConfirmDialogState, "open">) => {
    setConfirmDialog({
      ...dialog,
      open: true,
      onConfirm: async () => {
        setConfirmBusy(true);
        try {
          await dialog.onConfirm();
        } finally {
          setConfirmBusy(false);
          setConfirmDialog(null);
        }
      },
    });
  };

  // Firestore CRUD handlers (with local preview fallback when signed out)
  const handleAddTask = async (payload: {
    title: string;
    subject: string;
    deadline: string;
    notes: string;
  }) => {
    if (!user) {
      setTasks((prev) => [
        {
          id: `local_${Date.now()}`,
          userId: "local",
          title: payload.title,
          subject: payload.subject,
          deadline: payload.deadline,
          status: "pending",
          ...(payload.notes ? { notes: payload.notes } : {}),
        },
        ...prev,
      ]);
      return;
    }

    try {
      await addDoc(collection(db, "studyTasks"), {
        userId: user.uid,
        title: payload.title,
        subject: payload.subject,
        deadline: payload.deadline,
        status: "pending",
        ...(payload.notes ? { notes: payload.notes } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "studyTasks");
    }
  };

  const handleToggleTask = async (task: StudyTask) => {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    if (!user) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
      );
      return;
    }

    try {
      await updateDoc(doc(db, "studyTasks", task.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `studyTasks/${task.id}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      return;
    }

    try {
      await deleteDoc(doc(db, "studyTasks", taskId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `studyTasks/${taskId}`);
    }
  };

  const handleSaveThink = async (entry: {
    subject: string;
    question: string;
    initialThinking: string;
    confidence: (typeof CONFIDENCE_LEVELS)[number];
  }): Promise<ThinkEntry> => {
    if (!user) {
      const localItem: ThinkEntry = {
        id: `local_think_${Date.now()}`,
        userId: "local",
        ...entry,
      };
      setThinkEntries((prev) => [localItem, ...prev]);
      return localItem;
    }

    try {
      const ref = await addDoc(collection(db, "thinkEntries"), {
        userId: user.uid,
        subject: entry.subject,
        question: entry.question,
        initialThinking: entry.initialThinking,
        confidence: entry.confidence,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {
        id: ref.id,
        userId: user.uid,
        ...entry,
      };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "thinkEntries");
    }
  };

  const handleUpdateThinkHint = async (entryId: string, aiHint: string) => {
    if (!user || entryId.startsWith("local_")) {
      setThinkEntries((prev) =>
        prev.map((t) => (t.id === entryId ? { ...t, aiHint } : t))
      );
      return;
    }

    try {
      await updateDoc(doc(db, "thinkEntries", entryId), {
        aiHint,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `thinkEntries/${entryId}`);
    }
  };

  const handleSaveFactCheck = async (entry: {
    claim: string;
    source: string;
    verdict?: string;
    reliability: "pending" | "verified" | "needs_review" | "inaccurate";
  }) => {
    if (!user) {
      setFactChecks((prev) => [
        {
          id: `local_fact_${Date.now()}`,
          userId: "local",
          ...entry,
        },
        ...prev,
      ]);
      return;
    }

    try {
      await addDoc(collection(db, "factChecks"), {
        userId: user.uid,
        claim: entry.claim,
        source: entry.source,
        ...(entry.verdict ? { verdict: entry.verdict } : {}),
        reliability: entry.reliability,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "factChecks");
    }
  };

  const handleSaveSelfTest = async (entry: {
    topic: string;
    subject: string;
    ownExplanation: string;
    application: string;
    aiFeedback?: string;
  }) => {
    if (!user) {
      setSelfTests((prev) => [
        {
          id: `local_test_${Date.now()}`,
          userId: "local",
          ...entry,
        },
        ...prev,
      ]);
      return;
    }

    try {
      await addDoc(collection(db, "selfTests"), {
        userId: user.uid,
        topic: entry.topic,
        subject: entry.subject,
        ownExplanation: entry.ownExplanation,
        application: entry.application,
        ...(entry.aiFeedback ? { aiFeedback: entry.aiFeedback } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "selfTests");
    }
  };

  const handleSubmitSurvey = async (payload: {
    scores: number[];
    averageScore: number;
    reflection: string;
  }) => {
    if (!user) {
      setSurveys((prev) => [
        {
          id: `local_survey_${Date.now()}`,
          userId: "local",
          ...payload,
        },
        ...prev,
      ]);
      return;
    }

    try {
      await addDoc(collection(db, "surveys"), {
        userId: user.uid,
        scores: payload.scores,
        averageScore: payload.averageScore,
        ...(payload.reflection ? { reflection: payload.reflection } : {}),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, "surveys");
    }
  };

  // Workspace integration triggers with mandatory confirmation dialogs
  const requireWorkspaceToken = (): string | null => {
    if (!accessToken) {
      setToast({
        message:
          "Vui lòng nhấn 'Sign in with Google' ở góc trên (hoặc trong tab Workspace) để cấp quyền Google Workspace cho phiên làm việc hiện tại.",
        isError: true,
      });
      return null;
    }
    return accessToken;
  };

  const handleExportToSheets = () => {
    const token = requireWorkspaceToken();
    if (!token) return;

    const rows: (string | number)[][] = [
      ["Nhiệm vụ", "Môn học", "Hạn", "Trạng thái", "Ghi chú"],
      ...tasks.map((t) => [
        t.title,
        t.subject,
        t.deadline || "Chưa đặt",
        t.status === "completed" ? "Đã hoàn thành" : "Chưa hoàn thành",
        t.notes || "",
      ]),
    ];

    requestConfirm({
      title: "Xuất Study Plan sang Google Sheets?",
      description:
        "Hệ thống sẽ tạo một bảng tính Google Sheets mới trong Drive của bạn với toàn bộ nhiệm vụ hiện có.",
      details: [`Số nhiệm vụ xuất: ${tasks.length}`],
      confirmLabel: "Tạo Google Sheet",
      onConfirm: async () => {
        try {
          const sheet = await createStudyPlanSheet(
            token,
            `EDU SMART - Study Plan (${new Date().toLocaleDateString("vi-VN")})`,
            rows
          );
          setToast({
            message: "Đã đồng bộ Study Plan sang Google Sheets thành công.",
            linkUrl: sheet.spreadsheetUrl,
            linkLabel: "Mở Google Sheet",
          });
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Lỗi xuất Google Sheets.",
            isError: true,
          });
        }
      },
    });
  };

  const handleExportDoc = (title: string, content: string) => {
    const token = requireWorkspaceToken();
    if (!token) return;

    requestConfirm({
      title: "Lưu ghi chú sang Google Docs?",
      description: "Một tài liệu Google Docs mới sẽ được tạo trong Google Drive của bạn.",
      details: [`Tiêu đề: ${title}`],
      confirmLabel: "Tạo Google Doc",
      onConfirm: async () => {
        try {
          const created = await createStudyDoc(token, title, content);
          setToast({
            message: "Đã lưu ghi chú sang Google Docs.",
            linkUrl: created.url,
            linkLabel: "Mở Google Doc",
          });
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Lỗi tạo Google Doc.",
            isError: true,
          });
        }
      },
    });
  };

  const handleExportSlide = (title: string, subtitle: string, summary: string) => {
    const token = requireWorkspaceToken();
    if (!token) return;

    requestConfirm({
      title: "Tạo bài trình chiếu Google Slides?",
      description:
        "Hệ thống sẽ tạo một bản trình chiếu 2 slide từ ghi chú Think First trong Drive của bạn.",
      details: [`Tiêu đề: ${title}`],
      confirmLabel: "Tạo Google Slides",
      onConfirm: async () => {
        try {
          const deck = await createStudyPresentation(token, title, subtitle, summary);
          setToast({
            message: "Đã tạo bài thuyết trình Google Slides.",
            linkUrl: deck.url,
            linkLabel: "Mở Google Slides",
          });
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Lỗi tạo Google Slides.",
            isError: true,
          });
        }
      },
    });
  };

  const handleCreateSurveyForm = () => {
    const token = requireWorkspaceToken();
    if (!token) return;

    requestConfirm({
      title: "Tạo biểu mẫu khảo sát trên Google Forms?",
      description:
        "Biểu mẫu gồm 5 câu hỏi khảo sát thói quen tự học sẽ được tạo mới trong tài khoản Google của bạn.",
      confirmLabel: "Tạo Google Form",
      onConfirm: async () => {
        try {
          const form = await createStudyForm(
            token,
            "Khảo sát thói quen tự học - EDU SMART",
            [...SURVEY_QUESTIONS]
          );
          setToast({
            message: "Đã tạo Google Form khảo sát thành công.",
            linkUrl: form.responderUri,
            linkLabel: "Mở biểu mẫu",
          });
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Lỗi tạo Google Form.",
            isError: true,
          });
        }
      },
    });
  };

  const handleSendEmailReport = (recipientEmail: string) => {
    const token = requireWorkspaceToken();
    if (!token) return;
    const to = recipientEmail.trim() || user?.email || "";
    if (!to) {
      setToast({
        message: "Vui lòng nhập địa chỉ email người nhận.",
        isError: true,
      });
      return;
    }

    const doneCount = tasks.filter((t) => t.status === "completed").length;
    const body = [
      `Báo cáo tiến độ tự học EDU SMART`,
      `Học sinh: ${user?.displayName || user?.email || "Học sinh"}`,
      `Trường: Trường PTDTNT THPT Quảng Nam`,
      ``,
      `- Nhiệm vụ học tập: ${doneCount}/${tasks.length} hoàn thành`,
      `- Số lượt Think First: ${thinkEntries.length}`,
      `- Số lượt Kiểm chứng thông tin (Fact Check): ${factChecks.length}`,
      `- Số lượt Tự đánh giá (Self Test): ${selfTests.length}`,
      `- Số lượt Khảo sát thói quen: ${surveys.length}`,
    ].join("\n");

    requestConfirm({
      title: "Gửi báo cáo tiến độ qua Gmail?",
      description: "Email báo cáo tổng hợp sẽ được gửi trực tiếp từ hộp thư Gmail của bạn.",
      details: [`Người nhận: ${to}`, `Tiêu đề: Báo cáo tiến độ tự học EDU SMART`],
      confirmLabel: "Gửi email",
      onConfirm: async () => {
        try {
          await sendGmailReport(token, to, "Báo cáo tiến độ tự học EDU SMART", body);
          setToast({ message: `Đã gửi báo cáo tới ${to} qua Gmail.` });
        } catch (err) {
          setToast({
            message: err instanceof Error ? err.message : "Lỗi gửi Gmail.",
            isError: true,
          });
        }
      },
    });
  };

  const doneCount = tasks.filter((t) => t.status === "completed").length;
  const completionPct = tasks.length
    ? Math.round((doneCount / tasks.length) * 100)
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Single-line Brand wordmark */}
          <button
            type="button"
            onClick={() => navigateTo("home")}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            EDU <span className="text-sky-700">SMART</span>
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav
            aria-label="Điều hướng chính"
            className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600"
          >
            <button
              type="button"
              onClick={() => navigateTo("home")}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeModule === "home"
                  ? "border-sky-700 text-slate-900"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Trang chủ
            </button>
            <button
              type="button"
              onClick={() => navigateTo("study")}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeModule === "study"
                  ? "border-sky-700 text-slate-900"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Study Plan
            </button>
            <button
              type="button"
              onClick={() => navigateTo("think")}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeModule === "think" ||
                activeModule === "coach" ||
                activeModule === "check" ||
                activeModule === "test"
                  ? "border-sky-700 text-slate-900"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Tư duy &amp; AI
            </button>
            <button
              type="button"
              onClick={() => navigateTo("stats")}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeModule === "survey" || activeModule === "stats"
                  ? "border-sky-700 text-slate-900"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Thống kê
            </button>
            <button
              type="button"
              onClick={() => navigateTo("workspace")}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeModule === "workspace"
                  ? "border-sky-700 text-slate-900"
                  : "border-transparent hover:text-slate-900"
              }`}
            >
              Workspace
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2">
                {!accessToken && (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Kết nối Workspace
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  title={user.email || ""}
                >
                  <span className="max-w-[120px] truncate">
                    {user.displayName || user.email}
                  </span>
                  <LogOut className="h-3.5 w-3.5 text-slate-500" />
                </button>
              </div>
            ) : (
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? "Đang đăng nhập..." : "Sign in with Google"}
              />
            )}
          </div>
        </div>

        {/* Compact mobile navigation row */}
        <div className="flex md:hidden items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
          {[
            { id: "home", label: "Trang chủ" },
            { id: "study", label: "Study Plan" },
            { id: "think", label: "Think First" },
            { id: "coach", label: "AI Coach" },
            { id: "check", label: "Fact Check" },
            { id: "test", label: "Self Test" },
            { id: "survey", label: "Khảo sát" },
            { id: "stats", label: "Thống kê" },
            { id: "workspace", label: "Workspace" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id as ModuleId)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                activeModule === item.id ? "text-sky-700" : "text-slate-600"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Global Toast */}
      {toast && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6">
          <div
            className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium ${
              toast.isError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-teal-200 bg-teal-50 text-teal-900"
            }`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>{toast.message}</span>
              {toast.linkUrl && (
                <a
                  href={toast.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  {toast.linkLabel || "Mở liên kết"}
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded p-1 hover:bg-black/5 cursor-pointer"
              aria-label="Đóng thông báo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:py-10">
        {activeModule === "home" && (
          <div className="space-y-12">
            {/* Hero 2-Column Split */}
            <section className="grid items-stretch gap-8 lg:grid-cols-12">
              <div className="flex flex-col justify-center rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 lg:col-span-6">
                <p className="text-xs font-semibold tracking-wide text-sky-700">
                  Trường PTDTNT THPT Quảng Nam
                </p>
                <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  Học tập thông minh, làm chủ tư duy độc lập
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                  EDU SMART hỗ trợ học sinh hình thành thói quen tự học, tự suy luận
                  trước khi hỏi AI, kiểm chứng học liệu đáng tin cậy và đồng bộ tiến độ
                  trên Google Workspace.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => navigateTo("study")}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Bắt đầu học tập</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo("think")}
                    className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Thực hành Think First
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:col-span-6">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_edusmart_study_1795454712107.jpg"
                    alt="Học sinh Trường PTDTNT THPT Quảng Nam tự học và thảo luận nhóm trong thư viện"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-gradient-to-br from-sky-50 to-teal-50 p-8 text-center">
                    <Lightbulb className="h-12 w-12 text-sky-700" />
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      Không gian tự học EDU SMART
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Full-Width 4-Column KPI Strip directly below hero */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => navigateTo("study")}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-sky-300 cursor-pointer"
              >
                <p className="text-xs font-medium text-slate-500">Kế hoạch học tập</p>
                <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
                  {tasks.length} nhiệm vụ
                </p>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("stats")}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-sky-300 cursor-pointer"
              >
                <p className="text-xs font-medium text-slate-500">Tiến độ hoàn thành</p>
                <p className="font-mono-tabular mt-2 text-2xl font-bold text-teal-700">
                  {completionPct}% ({doneCount}/{tasks.length})
                </p>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("think")}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-sky-300 cursor-pointer"
              >
                <p className="text-xs font-medium text-slate-500">Lượt Think First</p>
                <p className="font-mono-tabular mt-2 text-2xl font-bold text-sky-700">
                  {thinkEntries.length} bài lập luận
                </p>
              </button>
              <button
                type="button"
                onClick={() => navigateTo("check")}
                className="rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-sky-300 cursor-pointer"
              >
                <p className="text-xs font-medium text-slate-500">
                  Kiểm chứng &amp; Tự đánh giá
                </p>
                <p className="font-mono-tabular mt-2 text-2xl font-bold text-slate-900">
                  {factChecks.length + selfTests.length} lượt
                </p>
              </button>
            </section>

            {/* Editorial Quote */}
            <section className="border-y border-slate-200 bg-white px-6 py-8 text-center rounded-2xl">
              <blockquote className="font-display mx-auto max-w-3xl text-lg leading-relaxed text-slate-800 sm:text-xl">
                “Trong cách học phải lấy tự học làm cốt. Học ở trường, trong sách vở,
                học lẫn nhau và học dân.”
              </blockquote>
              <p className="mt-3 text-xs font-semibold tracking-wide text-slate-500">
                Chủ tịch Hồ Chí Minh
              </p>
            </section>

            {/* 6 Core Learning Modules */}
            <section className="space-y-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Hệ thống học tập EDU SMART
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Chọn một phân hệ để bắt đầu chu trình tự học 6 bước khoa học.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("workspace")}
                  className="text-xs font-semibold text-sky-700 hover:underline self-start sm:self-auto cursor-pointer"
                >
                  Mở Google Workspace kết nối →
                </button>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  {
                    id: "study" as ModuleId,
                    index: "01",
                    title: "Study Plan",
                    subtitle: "Quản lý thời gian & mục tiêu",
                    desc: "Lập kế hoạch theo môn học, đặt hạn hoàn thành và đồng bộ sang Google Sheets.",
                    icon: <CalendarCheck className="h-5 w-5 text-sky-700" />,
                  },
                  {
                    id: "think" as ModuleId,
                    index: "02",
                    title: "Think First",
                    subtitle: "Rèn tư duy trước khi hỏi AI",
                    desc: "Ghi lại giả thuyết, công thức và lập luận cá nhân trước khi tìm sự hỗ trợ.",
                    icon: <Lightbulb className="h-5 w-5 text-sky-700" />,
                  },
                  {
                    id: "coach" as ModuleId,
                    index: "03",
                    title: "AI Coach",
                    subtitle: "Hướng dẫn Socratic từng bước",
                    desc: "Nhận câu hỏi gợi mở theo từng bước để tự tìm ra lời giải thay vì chép đáp án.",
                    icon: <Bot className="h-5 w-5 text-sky-700" />,
                  },
                  {
                    id: "check" as ModuleId,
                    index: "04",
                    title: "Fact Check",
                    subtitle: "Kiểm chứng nguồn học liệu",
                    desc: "Đối chiếu kiến thức với sách giáo khoa và tìm kiếm xác thực trực tuyến.",
                    icon: <SearchCheck className="h-5 w-5 text-teal-700" />,
                  },
                  {
                    id: "test" as ModuleId,
                    index: "05",
                    title: "Self Test",
                    subtitle: "Tự kiểm tra theo Feynman",
                    desc: "Diễn giải kiến thức bằng ngôn ngữ riêng và liên hệ tình huống thực tiễn.",
                    icon: <PenTool className="h-5 w-5 text-teal-700" />,
                  },
                  {
                    id: "survey" as ModuleId,
                    index: "06",
                    title: "Khảo sát & Thống kê",
                    subtitle: "Đo lường thói quen tự học",
                    desc: "Đánh giá định kỳ, xem biểu đồ tiến độ và gửi báo cáo tổng hợp qua Gmail.",
                    icon: <BarChart3 className="h-5 w-5 text-teal-700" />,
                  },
                ].map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => navigateTo(card.id)}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-300 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono-tabular text-xs font-semibold text-slate-400">
                          {card.index}
                        </span>
                        {card.icon}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-900 group-hover:text-sky-700">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        {card.subtitle}
                      </p>
                      <p className="mt-3 text-sm leading-relaxed text-slate-600">
                        {card.desc}
                      </p>
                    </div>
                    <div className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
                      <span>Mở phân hệ</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeModule === "study" && (
          <StudyPlanModule
            tasks={tasks}
            isSignedIn={Boolean(user)}
            hasWorkspaceToken={Boolean(accessToken)}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onExportToSheets={handleExportToSheets}
          />
        )}

        {(activeModule === "think" || activeModule === "coach") && (
          <ThinkAndCoachModule
            activeSubTab={activeModule === "coach" ? "coach" : "think"}
            onChangeSubTab={(tab) => navigateTo(tab)}
            thinkEntries={thinkEntries}
            onSaveThink={handleSaveThink}
            onUpdateThinkHint={handleUpdateThinkHint}
            onExportDoc={handleExportDoc}
            onExportSlide={handleExportSlide}
          />
        )}

        {(activeModule === "check" || activeModule === "test") && (
          <FactCheckAndTestModule
            activeSubTab={activeModule === "test" ? "test" : "check"}
            onChangeSubTab={(tab) => navigateTo(tab)}
            factChecks={factChecks}
            selfTests={selfTests}
            onSaveFactCheck={handleSaveFactCheck}
            onSaveSelfTest={handleSaveSelfTest}
            onExportDoc={handleExportDoc}
          />
        )}

        {(activeModule === "survey" || activeModule === "stats") && (
          <SurveyAndStatsModule
            activeSubTab={activeModule === "stats" ? "stats" : "survey"}
            onChangeSubTab={(tab) => navigateTo(tab)}
            tasks={tasks}
            thinkEntries={thinkEntries}
            factChecks={factChecks}
            selfTests={selfTests}
            surveys={surveys}
            onSubmitSurvey={handleSubmitSurvey}
            onCreateSurveyForm={handleCreateSurveyForm}
            onSendEmailReport={handleSendEmailReport}
            onExportSheetsReport={handleExportToSheets}
            defaultEmail={user?.email || ""}
          />
        )}

        {activeModule === "workspace" && (
          <WorkspaceHubModule
            accessToken={accessToken}
            userEmail={user?.email || ""}
            onGoogleLogin={handleGoogleLogin}
            isLoggingIn={isLoggingIn}
            tasks={tasks}
            thinkEntries={thinkEntries}
            surveys={surveys}
            requestConfirm={requestConfirm}
          />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 text-center text-xs text-slate-600 sm:flex-row sm:px-6 sm:text-left">
          <div>
            <p className="font-semibold text-slate-900">
              EDU SMART – Học tập chủ động, tư duy độc lập
            </p>
            <p className="mt-1 text-slate-500">
              Trường PTDTNT THPT Quảng Nam · Sử dụng AI có trách nhiệm
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => navigateTo("study")}
              className="hover:text-slate-900 cursor-pointer"
            >
              Study Plan
            </button>
            <button
              type="button"
              onClick={() => navigateTo("check")}
              className="hover:text-slate-900 cursor-pointer"
            >
              Fact Check
            </button>
            <button
              type="button"
              onClick={() => navigateTo("workspace")}
              className="hover:text-slate-900 cursor-pointer"
            >
              Google Workspace
            </button>
            {user && (
              <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã đồng bộ tài khoản</span>
              </span>
            )}
          </div>
        </div>
      </footer>

      <ConfirmModal
        dialog={confirmDialog}
        busy={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmDialog(null);
        }}
      />
    </div>
  );
}
