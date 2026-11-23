import React, { useState } from "react";
import {
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FormInput,
  Mail,
  MessageSquare,
  Presentation,
  RefreshCw,
  Trash2,
  Video,
} from "lucide-react";
import { GoogleSignInButton } from "./GoogleSignInButton";
import {
  createMeetSpace,
  createStudyDoc,
  createStudyForm,
  createStudyPlanSheet,
  createStudyPresentation,
  deleteDriveFile,
  getFormResponsesCount,
  listChatSpaces,
  listDriveFiles,
  listRecentEmails,
  postChatMessage,
  readSpreadsheetPreview,
  sendGmailReport,
  WorkspaceApiError,
  type ChatSpaceItem,
  type CreatedFormInfo,
  type CreatedSpreadsheet,
  type DriveFileItem,
  type GmailMessageSummary,
  type MeetSpaceInfo,
} from "../lib/workspace";
import { FIREBASE_PROJECT_ID } from "../lib/firebase";
import {
  SURVEY_QUESTIONS,
  type StudyTask,
  type SurveyResponse,
  type ThinkEntry,
} from "../types/edu";
import type { ConfirmDialogState } from "./ConfirmModal";

type WorkspaceTab =
  | "drive"
  | "sheets"
  | "gmail"
  | "docs"
  | "slides"
  | "chat"
  | "meet"
  | "forms";

interface WorkspaceHubModuleProps {
  accessToken: string | null;
  userEmail: string;
  onGoogleLogin: () => Promise<void>;
  isLoggingIn: boolean;
  tasks: StudyTask[];
  thinkEntries: ThinkEntry[];
  surveys: SurveyResponse[];
  requestConfirm: (dialog: Omit<ConfirmDialogState, "open">) => void;
}

export const WorkspaceHubModule: React.FC<WorkspaceHubModuleProps> = ({
  accessToken,
  userEmail,
  onGoogleLogin,
  isLoggingIn,
  tasks,
  thinkEntries,
  surveys,
  requestConfirm,
}) => {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("drive");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<{
    message: string;
    consoleUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  // Drive state
  const [driveSearch, setDriveSearch] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  // Sheets state
  const [createdSheet, setCreatedSheet] = useState<CreatedSpreadsheet | null>(null);
  const [sheetIdInput, setSheetIdInput] = useState("");
  const [sheetPreview, setSheetPreview] = useState<{
    title: string;
    sheetName: string;
    values: string[][];
  } | null>(null);

  // Gmail state
  const [emails, setEmails] = useState<GmailMessageSummary[]>([]);
  const [mailTo, setMailTo] = useState(userEmail);
  const [mailSubject, setMailSubject] = useState("Báo cáo tiến độ tự học EDU SMART");
  const [mailBody, setMailBody] = useState("");

  // Docs & Slides state
  const [docTitle, setDocTitle] = useState("Ghi chú tự học EDU SMART");
  const [docBody, setDocBody] = useState("");
  const [createdDocUrl, setCreatedDocUrl] = useState<string | null>(null);

  const [slideTitle, setSlideTitle] = useState("Tổng hợp ôn tập - EDU SMART");
  const [slideSummary, setSlideSummary] = useState("");
  const [createdSlideUrl, setCreatedSlideUrl] = useState<string | null>(null);

  // Chat state
  const [chatSpaces, setChatSpaces] = useState<ChatSpaceItem[]>([]);
  const [selectedSpace, setSelectedSpace] = useState("");
  const [chatText, setChatText] = useState(
    "Chào nhóm học tập, mình vừa hoàn thành mục tiêu tự học hôm nay trên EDU SMART!"
  );

  // Meet state
  const [meetInfo, setMeetInfo] = useState<MeetSpaceInfo | null>(null);

  // Forms state
  const [formTitle, setFormTitle] = useState("Phiếu tự đánh giá thói quen học tập");
  const [createdForm, setCreatedForm] = useState<CreatedFormInfo | null>(null);
  const [lookupFormId, setLookupFormId] = useState("");
  const [formStats, setFormStats] = useState<{
    title: string;
    responseCount: number;
  } | null>(null);

  const handleError = (err: unknown) => {
    if (err instanceof WorkspaceApiError) {
      setErrorBanner({
        message: err.message,
        consoleUrl: err.consoleUrl,
      });
    } else {
      setErrorBanner({
        message:
          err instanceof Error
            ? err.message
            : "Không thể kết nối Google Workspace API.",
      });
    }
  };

  if (!accessToken) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-xs font-semibold tracking-wide text-sky-700">
          Google Workspace Học Tập
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">
          Kết nối tài khoản Google Workspace của em
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Đăng nhập Google để truy cập trực tiếp Google Drive, Google Sheets, Gmail,
          Google Docs, Google Slides, Google Chat, Google Meet và Google Forms ngay
          trong không gian học tập EDU SMART.
        </p>
        <div className="mt-6 flex justify-center">
          <GoogleSignInButton
            onClick={onGoogleLogin}
            disabled={isLoggingIn}
            label={isLoggingIn ? "Đang kết nối..." : "Sign in with Google"}
          />
        </div>
      </div>
    );
  }

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: "drive", label: "Drive", icon: <FolderOpen className="h-3.5 w-3.5" /> },
    { id: "sheets", label: "Sheets", icon: <FileSpreadsheet className="h-3.5 w-3.5" /> },
    { id: "gmail", label: "Gmail", icon: <Mail className="h-3.5 w-3.5" /> },
    { id: "docs", label: "Docs", icon: <FileText className="h-3.5 w-3.5" /> },
    { id: "slides", label: "Slides", icon: <Presentation className="h-3.5 w-3.5" /> },
    { id: "chat", label: "Chat", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: "meet", label: "Meet", icon: <Video className="h-3.5 w-3.5" /> },
    { id: "forms", label: "Forms", icon: <FormInput className="h-3.5 w-3.5" /> },
  ];

  // Handlers
  const handleListDrive = async () => {
    setErrorBanner(null);
    setStatusMessage(null);
    setLoading(true);
    try {
      const files = await listDriveFiles(accessToken, driveSearch);
      setDriveFiles(files);
      setStatusMessage(`Đã tải ${files.length} tệp từ Google Drive.`);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDrive = (file: DriveFileItem) => {
    requestConfirm({
      title: "Xác nhận xóa tệp trên Google Drive?",
      description: `Thao tác này sẽ xóa vĩnh viễn tệp "${file.name}" khỏi Google Drive của bạn.`,
      details: [`Tên tệp: ${file.name}`, `ID: ${file.id}`],
      confirmLabel: "Xác nhận xóa tệp",
      isDestructive: true,
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          await deleteDriveFile(accessToken, file.id);
          setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
          setStatusMessage(`Đã xóa tệp "${file.name}" khỏi Google Drive.`);
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleCreateSheet = () => {
    const rows: (string | number)[][] = [
      ["Nhiệm vụ", "Môn học", "Hạn", "Trạng thái"],
      ...(tasks.length > 0
        ? tasks.map((t) => [
            t.title,
            t.subject,
            t.deadline || "Chưa đặt",
            t.status === "completed" ? "Đã hoàn thành" : "Chưa hoàn thành",
          ])
        : [["Chưa có nhiệm vụ mẫu", "Tổng hợp", "-", "Chờ cập nhật"]]),
    ];

    requestConfirm({
      title: "Tạo bảng tính Google Sheets mới?",
      description:
        "Ứng dụng sẽ tạo một tệp Google Sheets mới trong Drive của bạn chứa danh sách nhiệm vụ Study Plan hiện tại.",
      details: [
        `Tiêu đề: EDU SMART - Kế hoạch học tập`,
        `Số dòng dữ liệu: ${rows.length - 1} nhiệm vụ`,
      ],
      confirmLabel: "Tạo Google Sheet",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          const result = await createStudyPlanSheet(
            accessToken,
            `EDU SMART - Kế hoạch học tập (${new Date().toLocaleDateString("vi-VN")})`,
            rows
          );
          setCreatedSheet(result);
          setSheetIdInput(result.spreadsheetId);
          setStatusMessage("Đã tạo và đồng bộ dữ liệu sang Google Sheets.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleReadSheet = async () => {
    if (!sheetIdInput.trim()) return;
    setErrorBanner(null);
    setLoading(true);
    try {
      const preview = await readSpreadsheetPreview(accessToken, sheetIdInput.trim());
      setSheetPreview(preview);
      setStatusMessage(`Đã đọc tab "${preview.sheetName}" từ bảng tính.`);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadEmails = async () => {
    setErrorBanner(null);
    setLoading(true);
    try {
      const msgs = await listRecentEmails(accessToken);
      setEmails(msgs);
      setStatusMessage(`Đã tải ${msgs.length} email gần nhất.`);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = () => {
    const done = tasks.filter((t) => t.status === "completed").length;
    const defaultBody =
      mailBody.trim() ||
      `Báo cáo tự học EDU SMART (${userEmail}):\n- Nhiệm vụ hoàn thành: ${done}/${tasks.length}\n- Lượt Think First: ${thinkEntries.length}\n- Lượt khảo sát: ${surveys.length}`;

    if (!mailTo.trim()) {
      setErrorBanner({ message: "Vui lòng nhập email người nhận." });
      return;
    }

    requestConfirm({
      title: "Xác nhận gửi email qua Gmail?",
      description:
        "Email báo cáo học tập sẽ được gửi đi trực tiếp từ tài khoản Gmail của bạn.",
      details: [
        `Người nhận: ${mailTo.trim()}`,
        `Tiêu đề: ${mailSubject.trim()}`,
      ],
      confirmLabel: "Gửi email",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          await sendGmailReport(
            accessToken,
            mailTo.trim(),
            mailSubject.trim(),
            defaultBody
          );
          setStatusMessage(`Đã gửi email tới ${mailTo.trim()} thành công.`);
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleCreateDoc = () => {
    const content =
      docBody.trim() ||
      (thinkEntries[0]
        ? `Chủ đề: ${thinkEntries[0].subject}\nCâu hỏi: ${thinkEntries[0].question}\nSuy nghĩ ban đầu:\n${thinkEntries[0].initialThinking}`
        : "Ghi chú tự học từ nền tảng EDU SMART - Trường PTDTNT THPT Quảng Nam.");

    requestConfirm({
      title: "Tạo tài liệu Google Docs mới?",
      description:
        "Ứng dụng sẽ tạo một Google Doc mới trong Drive của bạn với nội dung ghi chú học tập.",
      details: [`Tiêu đề: ${docTitle.trim() || "Ghi chú học tập"}`],
      confirmLabel: "Tạo Google Doc",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          const doc = await createStudyDoc(
            accessToken,
            docTitle.trim() || "Ghi chú EDU SMART",
            content
          );
          setCreatedDocUrl(doc.url);
          setStatusMessage("Đã tạo Google Doc thành công.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleCreateSlides = () => {
    const summary =
      slideSummary.trim() ||
      (thinkEntries[0]
        ? `Câu hỏi: ${thinkEntries[0].question}\nHướng tư duy: ${thinkEntries[0].initialThinking}`
        : "1. Xác định mục tiêu tự học\n2. Thực hành Think First trước khi hỏi AI\n3. Kiểm chứng nguồn học liệu đáng tin cậy");

    requestConfirm({
      title: "Tạo bài trình chiếu Google Slides mới?",
      description:
        "Ứng dụng sẽ tạo một bản trình chiếu 2 slide trong Google Drive của bạn.",
      details: [`Tiêu đề: ${slideTitle.trim() || "Ôn tập EDU SMART"}`],
      confirmLabel: "Tạo Google Slides",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          const deck = await createStudyPresentation(
            accessToken,
            slideTitle.trim() || "Ôn tập EDU SMART",
            "Trường PTDTNT THPT Quảng Nam · EDU SMART",
            summary
          );
          setCreatedSlideUrl(deck.url);
          setStatusMessage("Đã tạo bài thuyết trình Google Slides thành công.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleListChatSpaces = async () => {
    setErrorBanner(null);
    setLoading(true);
    try {
      const spaces = await listChatSpaces(accessToken);
      setChatSpaces(spaces);
      if (spaces[0]) setSelectedSpace(spaces[0].name);
      setStatusMessage(`Tìm thấy ${spaces.length} không gian Google Chat.`);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostChat = () => {
    if (!selectedSpace.trim() || !chatText.trim()) {
      setErrorBanner({
        message: "Vui lòng chọn hoặc nhập mã không gian Google Chat và nội dung tin nhắn.",
      });
      return;
    }

    requestConfirm({
      title: "Gửi tin nhắn lên Google Chat?",
      description: "Tin nhắn chia sẻ tiến độ học tập sẽ được đăng vào không gian Chat đã chọn.",
      details: [`Không gian: ${selectedSpace}`, `Nội dung: ${chatText.slice(0, 120)}`],
      confirmLabel: "Gửi tin nhắn",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          await postChatMessage(accessToken, selectedSpace.trim(), chatText.trim());
          setStatusMessage("Đã gửi tin nhắn lên Google Chat.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleCreateMeet = () => {
    requestConfirm({
      title: "Tạo phòng họp nhóm Google Meet?",
      description:
        "Ứng dụng sẽ tạo một phòng họp Google Meet mới để em trao đổi bài tập cùng bạn bè hoặc giáo viên.",
      confirmLabel: "Tạo phòng Meet",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          const room = await createMeetSpace(accessToken);
          setMeetInfo(room);
          setStatusMessage("Đã tạo phòng họp Google Meet thành công.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleCreateForm = () => {
    requestConfirm({
      title: "Tạo biểu mẫu Google Forms mới?",
      description:
        "Ứng dụng sẽ tạo một biểu mẫu Google Forms gồm 5 câu hỏi khảo sát thói quen tự học.",
      details: [`Tiêu đề: ${formTitle.trim()}`],
      confirmLabel: "Tạo Google Form",
      onConfirm: async () => {
        setErrorBanner(null);
        try {
          const form = await createStudyForm(
            accessToken,
            formTitle.trim() || "Khảo sát thói quen tự học EDU SMART",
            [...SURVEY_QUESTIONS]
          );
          setCreatedForm(form);
          setLookupFormId(form.formId);
          setStatusMessage("Đã tạo biểu mẫu Google Forms thành công.");
        } catch (err) {
          handleError(err);
        }
      },
    });
  };

  const handleLookupForm = async () => {
    if (!lookupFormId.trim()) return;
    setErrorBanner(null);
    setLoading(true);
    try {
      const stats = await getFormResponsesCount(accessToken, lookupFormId);
      setFormStats(stats);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-700">
            05. Hệ sinh thái Google Workspace
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Workspace Học Tập Kết Nối
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Quản lý tài liệu Drive, xuất bảng tính Sheets, gửi email Gmail, soạn Docs,
            Slides, họp nhóm Meet, trao đổi Chat và khảo sát Forms trong một màn hình.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Đã kết nối: <strong className="text-slate-900">{userEmail}</strong>
        </div>
      </div>

      {/* Segmented Workspace tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              setErrorBanner(null);
              setStatusMessage(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === tab.id
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-medium text-teal-900">
          {statusMessage}
        </div>
      )}

      {errorBanner && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-800"
          role="alert"
        >
          <p className="font-semibold">{errorBanner.message}</p>
          {errorBanner.consoleUrl && (
            <a
              href={errorBanner.consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 font-semibold underline"
            >
              <span>Mở trang cấu hình Google Chat App trong Cloud Console</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}

      {/* Tab panels */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        {activeTab === "drive" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">
                Google Drive – Học liệu của em
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={driveSearch}
                  onChange={(e) => setDriveSearch(e.target.value)}
                  placeholder="Tìm theo tên tệp..."
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleListDrive}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{loading ? "Đang tải..." : "Tải danh sách tệp"}</span>
                </button>
              </div>
            </div>

            {driveFiles.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                Nhấn &ldquo;Tải danh sách tệp&rdquo; để xem các học liệu gần nhất trên
                Google Drive của em.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {driveFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {file.mimeType.replace("application/vnd.google-apps.", "Google ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file.webViewLink && (
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                        >
                          <span>Mở</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDrive(file)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer"
                        aria-label={`Xóa tệp ${file.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "sheets" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Google Sheets – Đồng bộ Kế hoạch học tập
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Tạo nhanh bảng tính theo dõi nhiệm vụ hoặc đọc dữ liệu từ một Sheet có
                  sẵn.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCreateSheet}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Xuất Study Plan sang Google Sheet mới
              </button>
            </div>

            {createdSheet && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <p className="font-semibold text-slate-900">
                  Đã tạo bảng tính (Tab: {createdSheet.firstSheetTitle})
                </p>
                <a
                  href={createdSheet.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                >
                  <span>Mở Google Sheet vừa tạo</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            <div className="border-t border-slate-100 pt-5">
              <label
                htmlFor="sheet-id-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Đọc xem trước bảng tính theo Spreadsheet ID
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="sheet-id-input"
                  type="text"
                  value={sheetIdInput}
                  onChange={(e) => setSheetIdInput(e.target.value)}
                  placeholder="Dán Spreadsheet ID..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleReadSheet}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Đọc dữ liệu
                </button>
              </div>

              {sheetPreview && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
                    {sheetPreview.title} · Tab: {sheetPreview.sheetName}
                  </div>
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {sheetPreview.values.map((row, rIdx) => (
                        <tr key={rIdx} className="border-t border-slate-100">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-3 py-2 ${
                                rIdx === 0 ? "font-semibold text-slate-900" : "text-slate-600"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "gmail" && (
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-6">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  Hộp thư học tập gần đây
                </h3>
                <button
                  type="button"
                  onClick={handleLoadEmails}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {loading ? "Đang tải..." : "Tải email"}
                </button>
              </div>
              {emails.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">
                  Nhấn &ldquo;Tải email&rdquo; để xem 6 thư gần nhất trong Gmail của em.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {emails.map((m) => (
                    <li key={m.id} className="py-3">
                      <p className="text-xs font-semibold text-slate-900">{m.subject}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">{m.from}</p>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                        {m.snippet}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3 lg:col-span-6">
              <h3 className="text-base font-semibold text-slate-900">
                Gửi báo cáo tiến độ qua Gmail
              </h3>
              <input
                type="email"
                value={mailTo}
                onChange={(e) => setMailTo(e.target.value)}
                placeholder="Email người nhận"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <input
                type="text"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                placeholder="Tiêu đề email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <textarea
                rows={4}
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                placeholder="Để trống để hệ thống tự điền tóm tắt tiến độ Study Plan & Think First..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSendEmail}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Gửi email báo cáo
              </button>
            </div>
          </div>
        )}

        {activeTab === "docs" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Google Docs – Lưu trữ ghi chú &amp; lập luận Think First
            </h3>
            <input
              type="text"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder="Tiêu đề tài liệu Google Docs"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <textarea
              rows={5}
              value={docBody}
              onChange={(e) => setDocBody(e.target.value)}
              placeholder="Nhập nội dung ghi chú hoặc để trống để xuất từ mục Think First gần nhất..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreateDoc}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Tạo Google Doc mới
              </button>
              {createdDocUrl && (
                <a
                  href={createdDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  <span>Mở Google Doc vừa tạo</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === "slides" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Google Slides – Tạo bộ slide ôn tập nhanh
            </h3>
            <input
              type="text"
              value={slideTitle}
              onChange={(e) => setSlideTitle(e.target.value)}
              placeholder="Tiêu đề bài thuyết trình"
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <textarea
              rows={4}
              value={slideSummary}
              onChange={(e) => setSlideSummary(e.target.value)}
              placeholder="Các ý chính đưa lên slide tóm tắt..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCreateSlides}
                className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Tạo Google Slides mới
              </button>
              {createdSlideUrl && (
                <a
                  href={createdSlideUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                >
                  <span>Mở Google Slides vừa tạo</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Google Chat – Trao đổi nhóm học tập
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Lưu ý: Google Chat API chỉ khả dụng với tài khoản Google Workspace
                  của trường học/tổ chức và yêu cầu bật cấu hình Chat App trên dự án{" "}
                  <span className="font-mono-tabular">{FIREBASE_PROJECT_ID}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleListChatSpaces}
                disabled={loading}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {loading ? "Đang tải..." : "Tải danh sách phòng Chat"}
              </button>
            </div>

            {chatSpaces.length > 0 && (
              <select
                value={selectedSpace}
                onChange={(e) => setSelectedSpace(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
              >
                {chatSpaces.map((sp) => (
                  <option key={sp.name} value={sp.name}>
                    {sp.displayName || sp.name}
                  </option>
                ))}
              </select>
            )}

            <textarea
              rows={3}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Nội dung chia sẻ tiến độ học tập..."
              className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePostChat}
              className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
            >
              Đăng tin nhắn vào Google Chat
            </button>
          </div>
        )}

        {activeTab === "meet" && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              Google Meet – Tạo phòng học nhóm trực tuyến
            </h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Khởi tạo ngay một liên kết Google Meet để thảo luận bài tập hoặc trao đổi
              với giáo viên hướng dẫn.
            </p>
            <button
              type="button"
              onClick={handleCreateMeet}
              className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
            >
              <Video className="h-4 w-4" />
              <span>Tạo phòng Google Meet mới</span>
            </button>

            {meetInfo && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                <p className="font-semibold text-slate-900">
                  Mã phòng: <span className="font-mono-tabular">{meetInfo.meetingCode}</span>
                </p>
                <a
                  href={meetInfo.meetingUri}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                >
                  <span>Tham gia phòng họp ({meetInfo.meetingUri})</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </div>
        )}

        {activeTab === "forms" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">
                Google Forms – Tạo phiếu khảo sát &amp; kiểm tra
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateForm}
                  className="rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Tạo Google Form khảo sát
                </button>
              </div>

              {createdForm && (
                <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                  <a
                    href={createdForm.responderUri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                  >
                    <span>Link trả lời biểu mẫu</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={createdForm.editUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline"
                  >
                    <span>Chỉnh sửa biểu mẫu</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-5">
              <label
                htmlFor="lookup-form-id"
                className="block text-xs font-semibold text-slate-700"
              >
                Kiểm tra số lượt phản hồi theo Form ID
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="lookup-form-id"
                  type="text"
                  value={lookupFormId}
                  onChange={(e) => setLookupFormId(e.target.value)}
                  placeholder="Nhập Google Form ID..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleLookupForm}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Xem lượt phản hồi
                </button>
              </div>
              {formStats && (
                <p className="mt-2 text-xs text-slate-700">
                  Biểu mẫu <strong>{formStats.title}</strong> hiện có{" "}
                  <span className="font-mono-tabular font-bold text-sky-700">
                    {formStats.responseCount}
                  </span>{" "}
                  phản hồi.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
