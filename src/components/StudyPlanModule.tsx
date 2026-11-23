import React, { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Sparkles,
  Trash2,
  FileSpreadsheet,
} from "lucide-react";
import { FIELD_LIMITS, SUBJECTS, type StudyTask } from "../types/edu";

interface StudyPlanModuleProps {
  tasks: StudyTask[];
  isSignedIn: boolean;
  hasWorkspaceToken: boolean;
  onAddTask: (task: {
    title: string;
    subject: string;
    deadline: string;
    notes: string;
  }) => Promise<void>;
  onToggleTask: (task: StudyTask) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onExportToSheets: () => void;
}

export const StudyPlanModule: React.FC<StudyPlanModuleProps> = ({
  tasks,
  isSignedIn,
  hasWorkspaceToken,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onExportToSheets,
}) => {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [filterSubject, setFilterSubject] = useState<string>("Tất cả");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // AI study suggestions
  const [aiGoal, setAiGoal] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ title: string; notes: string }[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError("Vui lòng nhập nội dung nhiệm vụ học tập.");
      return;
    }
    setSubmitting(true);
    try {
      await onAddTask({
        title: trimmed.slice(0, FIELD_LIMITS.taskTitle),
        subject: subject.slice(0, FIELD_LIMITS.subject),
        deadline: deadline.slice(0, FIELD_LIMITS.deadline),
        notes: notes.trim().slice(0, FIELD_LIMITS.notes),
      });
      setTitle("");
      setDeadline("");
      setNotes("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không thể lưu nhiệm vụ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateSuggestions = async () => {
    setAiError(null);
    if (!aiGoal.trim()) {
      setAiError("Hãy nhập mục tiêu ôn tập để nhận 3 gợi ý nhiệm vụ.");
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/study-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, goal: aiGoal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo gợi ý kế hoạch.");
      }
      setSuggestions(data.tasks || []);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Lỗi kết nối máy chủ AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddSuggestedTask = async (item: { title: string; notes: string }) => {
    await onAddTask({
      title: item.title.slice(0, FIELD_LIMITS.taskTitle),
      subject,
      deadline: "",
      notes: item.notes.slice(0, FIELD_LIMITS.notes),
    });
    setSuggestions((prev) => prev.filter((s) => s.title !== item.title));
  };

  const filteredTasks = tasks.filter((t) => {
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "completed" && t.status === "completed") ||
      (filterStatus === "pending" && t.status === "pending");
    const matchSubject = filterSubject === "Tất cả" || t.subject === filterSubject;
    return matchStatus && matchSubject;
  });

  const doneCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-700">
            01. Lập kế hoạch tự học
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Study Plan – Kế hoạch học tập
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Chủ động phân bổ thời gian, đặt hạn hoàn thành cho từng môn học và đồng bộ
            bảng theo dõi sang Google Sheets khi cần báo cáo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs text-slate-500 tabular-nums">
            Hoàn thành: <strong className="text-slate-900">{doneCount}</strong> /{" "}
            {tasks.length} nhiệm vụ
          </div>
          <button
            type="button"
            onClick={onExportToSheets}
            disabled={tasks.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-teal-700" />
            <span>
              {hasWorkspaceToken ? "Xuất sang Google Sheets" : "Kết nối Google để xuất Sheet"}
            </span>
          </button>
        </div>
      </div>

      {!isSignedIn && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Chế độ xem trước cục bộ: Dữ liệu hiện lưu tạm trong phiên làm việc. Đăng nhập bằng
          tài khoản Google ở góc trên để lưu vĩnh viễn vào hồ sơ học tập cá nhân.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left column: Create Task + AI Assistant */}
        <div className="space-y-6 lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Thêm nhiệm vụ học tập mới
            </h3>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="task-title"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tên nhiệm vụ
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={title}
                  maxLength={FIELD_LIMITS.taskTitle}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Làm 10 bài tập phương trình lượng giác..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="task-subject"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Môn học
                  </label>
                  <select
                    id="task-subject"
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
                    htmlFor="task-deadline"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Hạn hoàn thành
                  </label>
                  <input
                    id="task-deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="task-notes"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Ghi chú tự kiểm tra (tùy chọn)
                </label>
                <input
                  id="task-notes"
                  type="text"
                  value={notes}
                  maxLength={FIELD_LIMITS.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Tiêu chí hoàn thành hoặc tài liệu tham khảo..."
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {formError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{submitting ? "Đang lưu..." : "Thêm nhiệm vụ"}</span>
              </button>
            </div>
          </form>

          {/* AI Plan Helper */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-sky-700" />
              <span>Gợi ý chia nhỏ mục tiêu ôn tập</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Nhập mục tiêu tuần này cho môn <strong>{subject}</strong>, hệ thống AI sẽ
              gợi ý 3 nhiệm vụ cụ thể để em tự chọn và điều chỉnh.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                placeholder="Ví dụ: Ôn tập chương đạo hàm để kiểm tra 15 phút"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleGenerateSuggestions}
                disabled={aiLoading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {aiLoading ? "Đang phân tích..." : "Gợi ý"}
              </button>
            </div>
            {aiError && <p className="mt-2 text-xs text-red-600">{aiError}</p>}
            {suggestions.length > 0 && (
              <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
                {suggestions.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600">{item.notes}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddSuggestedTask(item)}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      + Thêm
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Task List */}
        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                {[
                  { id: "all", label: "Tất cả" },
                  { id: "pending", label: "Đang làm" },
                  { id: "completed", label: "Đã xong" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setFilterStatus(tab.id as "all" | "pending" | "completed")
                    }
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      filterStatus === tab.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <select
                aria-label="Lọc theo môn học"
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-sky-600 focus:outline-none"
              >
                <option value="Tất cả">Tất cả môn học</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  Chưa có nhiệm vụ nào phù hợp bộ lọc hiện tại.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Hãy thêm nhiệm vụ mới ở cột bên trái để bắt đầu kế hoạch tự học.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredTasks.map((task) => {
                  const isDone = task.status === "completed";
                  return (
                    <li
                      key={task.id}
                      className="flex items-start justify-between gap-4 py-4"
                    >
                      <button
                        type="button"
                        onClick={() => onToggleTask(task)}
                        className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-teal-600 cursor-pointer"
                        aria-label={
                          isDone ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"
                        }
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-teal-600" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            isDone ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{task.subject}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            Hạn: {task.deadline || "Chưa đặt"}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              isDone ? "font-medium text-teal-700" : "text-slate-600"
                            }
                          >
                            {isDone ? "Đã hoàn thành" : "Đang thực hiện"}
                          </span>
                        </div>
                        {task.notes && (
                          <p className="mt-1.5 text-xs text-slate-600">{task.notes}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 shrink-0 cursor-pointer"
                        aria-label="Xóa nhiệm vụ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
