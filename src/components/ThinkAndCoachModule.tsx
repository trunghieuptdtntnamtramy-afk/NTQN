import React, { useState } from "react";
import {
  ArrowRight,
  Bot,
  FileText,
  Lightbulb,
  Presentation,
  Send,
} from "lucide-react";
import {
  CONFIDENCE_LEVELS,
  FIELD_LIMITS,
  SUBJECTS,
  type ThinkEntry,
} from "../types/edu";

interface ThinkAndCoachModuleProps {
  activeSubTab: "think" | "coach";
  onChangeSubTab: (tab: "think" | "coach") => void;
  thinkEntries: ThinkEntry[];
  onSaveThink: (entry: {
    subject: string;
    question: string;
    initialThinking: string;
    confidence: (typeof CONFIDENCE_LEVELS)[number];
  }) => Promise<ThinkEntry>;
  onUpdateThinkHint: (entryId: string, aiHint: string) => Promise<void>;
  onExportDoc: (title: string, content: string) => void;
  onExportSlide: (title: string, subtitle: string, summary: string) => void;
}

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export const ThinkAndCoachModule: React.FC<ThinkAndCoachModuleProps> = ({
  activeSubTab,
  onChangeSubTab,
  thinkEntries,
  onSaveThink,
  onUpdateThinkHint,
  onExportDoc,
  onExportSlide,
}) => {
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [question, setQuestion] = useState("");
  const [initialThinking, setInitialThinking] = useState("");
  const [confidence, setConfidence] = useState<(typeof CONFIDENCE_LEVELS)[number]>(
    CONFIDENCE_LEVELS[1]
  );
  const [savingThink, setSavingThink] = useState(false);
  const [thinkNotice, setThinkNotice] = useState<string | null>(null);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);

  // AI Coach state
  const [coachInput, setCoachInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const handleSaveThink = async (e: React.FormEvent, goToCoach = false) => {
    e.preventDefault();
    setThinkError(null);
    setThinkNotice(null);

    if (!question.trim() || !initialThinking.trim()) {
      setThinkError(
        "Hãy nhập cả câu hỏi và suy nghĩ lập luận ban đầu của em trước khi lưu hoặc hỏi AI."
      );
      return;
    }

    setSavingThink(true);
    try {
      const saved = await onSaveThink({
        subject,
        question: question.trim().slice(0, FIELD_LIMITS.question),
        initialThinking: initialThinking.trim().slice(0, FIELD_LIMITS.thinking),
        confidence,
      });
      setActiveEntryId(saved.id);
      setThinkNotice(
        "Đã ghi nhận suy nghĩ ban đầu. Em có thể chuyển sang AI Coach để nhận gợi ý từng bước."
      );
      if (goToCoach) {
        onChangeSubTab("coach");
        await requestCoachHint(
          question.trim(),
          initialThinking.trim(),
          subject,
          confidence,
          saved.id
        );
      }
    } catch (err) {
      setThinkError(err instanceof Error ? err.message : "Không thể lưu dữ liệu.");
    } finally {
      setSavingThink(false);
    }
  };

  const requestCoachHint = async (
    promptText: string,
    thinkingCtx: string,
    subj: string,
    conf: string,
    entryIdToUpdate: string | null,
    appendUserMessage = false
  ) => {
    setCoachError(null);
    setCoachLoading(true);

    const nextHistory = appendUserMessage
      ? [...chatHistory, { role: "user" as const, text: promptText }]
      : chatHistory;
    if (appendUserMessage) {
      setChatHistory(nextHistory);
    }

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: promptText,
          initialThinking: thinkingCtx,
          subject: subj,
          confidence: conf,
          history: nextHistory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể nhận gợi ý từ AI Coach.");
      }

      const replyText = String(data.reply || "").trim();
      setChatHistory((prev) => [...prev, { role: "assistant", text: replyText }]);

      if (entryIdToUpdate && replyText) {
        await onUpdateThinkHint(entryIdToUpdate, replyText.slice(0, FIELD_LIMITS.aiText));
      }
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : "Lỗi kết nối máy chủ AI.");
    } finally {
      setCoachLoading(false);
    }
  };

  const handleCoachSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = coachInput.trim();
    if (!text) {
      setCoachError("Vui lòng nhập nội dung em đang vướng mắc.");
      return;
    }
    setCoachInput("");
    await requestCoachHint(
      text,
      initialThinking.trim(),
      subject,
      confidence,
      activeEntryId,
      true
    );
  };

  const latestThink = thinkEntries[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-700">
            02. Quy trình tư duy độc lập
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Think First &amp; AI Coach
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Rèn luyện thói quen tự suy luận trước khi tham khảo AI. AI Coach đóng vai người
            hướng dẫn Socratic giúp em tự tìm ra lời giải thay vì chép đáp án.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onChangeSubTab("think")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "think"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Bước 1: Think First</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab("coach")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "coach"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>Bước 2: AI Coach</span>
          </button>
        </div>
      </div>

      {activeSubTab === "think" ? (
        <div className="grid gap-8 lg:grid-cols-12">
          <form
            onSubmit={(e) => handleSaveThink(e, false)}
            className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Ghi nhận suy nghĩ ban đầu của em
            </h3>
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="think-subject"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Môn học
                  </label>
                  <select
                    id="think-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="think-confidence"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Mức độ tự tin
                  </label>
                  <select
                    id="think-confidence"
                    value={confidence}
                    onChange={(e) =>
                      setConfidence(
                        e.target.value as (typeof CONFIDENCE_LEVELS)[number]
                      )
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {CONFIDENCE_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="think-question"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Câu hỏi hoặc vấn đề cần giải quyết
                </label>
                <textarea
                  id="think-question"
                  rows={3}
                  maxLength={FIELD_LIMITS.question}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Nhập đề bài hoặc câu hỏi em đang tìm hiểu..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="think-reasoning"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Suy nghĩ và lập luận ban đầu
                </label>
                <textarea
                  id="think-reasoning"
                  rows={5}
                  maxLength={FIELD_LIMITS.thinking}
                  value={initialThinking}
                  onChange={(e) => setInitialThinking(e.target.value)}
                  placeholder="Trình bày cách hiểu, hướng giải dự kiến, công thức liên quan hoặc đáp án thử của em..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {thinkError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {thinkError}
                </p>
              )}
              {thinkNotice && (
                <p className="rounded-lg bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                  {thinkNotice}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={savingThink}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {savingThink ? "Đang lưu..." : "Lưu suy nghĩ"}
                </button>
                <button
                  type="button"
                  disabled={savingThink}
                  onClick={(e) => handleSaveThink(e, true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  <span>Lưu &amp; Nhận gợi ý từ AI Coach</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>

          {/* Think First Archive + Media */}
          <div className="space-y-6 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-4/3 w-full overflow-hidden bg-slate-100">
                <img
                  src="/src/assets/images/card_think_first_1795454711276.jpg"
                  alt="Sổ tay lập sơ đồ tư duy trước khi học với AI"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Nhật ký Think First gần đây ({thinkEntries.length})
                </h3>
                {thinkEntries.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Chưa có ghi chép nào. Hãy viết lập luận đầu tiên của em ở bên trái.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {thinkEntries.slice(0, 4).map((entry) => (
                      <li key={entry.id} className="py-3">
                        <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                          {entry.question}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{entry.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span>{entry.confidence}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              onExportDoc(
                                `Think First - ${entry.subject}`,
                                `Môn học: ${entry.subject}\nMức độ tự tin: ${entry.confidence}\n\nCâu hỏi:\n${entry.question}\n\nSuy nghĩ ban đầu:\n${entry.initialThinking}\n\nGợi ý AI Coach:\n${entry.aiHint || "Chưa có"}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5 text-sky-700" />
                            <span>Lưu Google Docs</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              onExportSlide(
                                `Ôn tập: ${entry.subject}`,
                                `Trường PTDTNT THPT Quảng Nam · Think First`,
                                `Vấn đề:\n${entry.question}\n\nHướng tư duy:\n${entry.initialThinking}`
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            <Presentation className="h-3.5 w-3.5 text-amber-600" />
                            <span>Tạo Slides</span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* AI Coach Socratic Workspace */
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Ngữ cảnh Think First đang áp dụng
            </h3>
            {question.trim() || latestThink ? (
              <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
                <div>
                  <span className="font-semibold text-slate-800">Môn học: </span>
                  {question.trim() ? subject : latestThink?.subject}
                </div>
                <div>
                  <span className="font-semibold text-slate-800">Câu hỏi: </span>
                  <p className="mt-1 rounded-lg bg-slate-50 p-3 text-slate-800">
                    {question.trim() || latestThink?.question}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-800">
                    Lập luận của em:
                  </span>
                  <p className="mt-1 rounded-lg bg-slate-50 p-3 text-slate-700">
                    {initialThinking.trim() || latestThink?.initialThinking}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-600">
                <p>
                  Em chưa điền phần Think First. Hãy nhập câu hỏi trực tiếp bên phải hoặc
                  quay lại Bước 1 để ghi suy nghĩ ban đầu trước.
                </p>
                <button
                  type="button"
                  onClick={() => onChangeSubTab("think")}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 cursor-pointer"
                >
                  Quay lại Think First
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  AI Coach – Trợ lý gợi mở từng bước
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Khuyến khích tự suy luận theo phương pháp Socratic
                </p>
              </div>
              {chatHistory.length > 0 && (
                <button
                  type="button"
                  onClick={() => setChatHistory([])}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Làm mới hội thoại
                </button>
              )}
            </div>

            <div className="my-4 min-h-[260px] max-h-[440px] flex-1 space-y-4 overflow-y-auto pr-1">
              {chatHistory.length === 0 ? (
                <div className="rounded-xl bg-slate-50 p-5 text-sm leading-relaxed text-slate-600">
                  AI Coach sẽ phân tích hướng suy nghĩ của em, đặt câu hỏi gợi mở và chia
                  vấn đề thành các bước nhỏ thay vì đưa ngay đáp án cuối cùng. Hãy đặt câu
                  hỏi bên dưới để bắt đầu.
                </div>
              ) : (
                chatHistory.map((turn, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                      turn.role === "user"
                        ? "ml-auto max-w-[85%] bg-sky-700 text-white"
                        : "mr-auto max-w-[92%] border border-slate-200 bg-slate-50 text-slate-800"
                    }`}
                  >
                    <p className="mb-1 text-xs font-semibold opacity-75">
                      {turn.role === "user" ? "Em" : "AI Coach"}
                    </p>
                    {turn.text}
                  </div>
                ))
              )}

              {coachLoading && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  AI Coach đang phân tích lập luận và chuẩn bị gợi ý từng bước...
                </div>
              )}
            </div>

            {coachError && (
              <p className="mb-3 text-xs font-medium text-red-600" role="alert">
                {coachError}
              </p>
            )}

            <form onSubmit={handleCoachSend} className="flex gap-2.5 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={coachInput}
                onChange={(e) => setCoachInput(e.target.value)}
                placeholder="Em đang gặp khó khăn ở bước nào hoặc muốn kiểm tra hướng giải nào?"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={coachLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>Nhận gợi ý</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
