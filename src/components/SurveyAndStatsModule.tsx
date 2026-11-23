import React, { useState } from "react";
import { BarChart3, ClipboardList, Mail, FileSpreadsheet } from "lucide-react";
import {
  FIELD_LIMITS,
  SUBJECTS,
  SURVEY_OPTIONS,
  SURVEY_QUESTIONS,
  type FactCheckEntry,
  type SelfTestEntry,
  type StudyTask,
  type SurveyResponse,
  type ThinkEntry,
} from "../types/edu";

interface SurveyAndStatsModuleProps {
  activeSubTab: "survey" | "stats";
  onChangeSubTab: (tab: "survey" | "stats") => void;
  tasks: StudyTask[];
  thinkEntries: ThinkEntry[];
  factChecks: FactCheckEntry[];
  selfTests: SelfTestEntry[];
  surveys: SurveyResponse[];
  onSubmitSurvey: (payload: {
    scores: number[];
    averageScore: number;
    reflection: string;
  }) => Promise<void>;
  onCreateSurveyForm: () => void;
  onSendEmailReport: (recipientEmail: string) => void;
  onExportSheetsReport: () => void;
  defaultEmail?: string;
}

export const SurveyAndStatsModule: React.FC<SurveyAndStatsModuleProps> = ({
  activeSubTab,
  onChangeSubTab,
  tasks,
  thinkEntries,
  factChecks,
  selfTests,
  surveys,
  onSubmitSurvey,
  onCreateSurveyForm,
  onSendEmailReport,
  onExportSheetsReport,
  defaultEmail = "",
}) => {
  const [scores, setScores] = useState<number[]>([4, 4, 4, 4, 4]);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [surveyNotice, setSurveyNotice] = useState<string | null>(null);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [reportEmail, setReportEmail] = useState(defaultEmail);

  const handleScoreChange = (index: number, value: number) => {
    setScores((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSurveyError(null);
    setSurveyNotice(null);
    const averageScore =
      Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) /
      100;

    setSubmitting(true);
    try {
      await onSubmitSurvey({
        scores,
        averageScore,
        reflection: reflection.trim().slice(0, FIELD_LIMITS.reflection),
      });
      setReflection("");
      setSurveyNotice(
        `Đã ghi nhận câu trả lời khảo sát. Điểm trung bình thói quen tự học: ${averageScore.toFixed(2)} / 5.00.`
      );
    } catch (err) {
      setSurveyError(err instanceof Error ? err.message : "Không thể gửi khảo sát.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "completed").length;
  const progressPercent = totalTasks
    ? Math.round((doneTasks / totalTasks) * 100)
    : 0;

  const subjectStats = SUBJECTS.map((subj) => {
    const subjTasks = tasks.filter((t) => t.subject === subj);
    const subjDone = subjTasks.filter((t) => t.status === "completed").length;
    return {
      subject: subj,
      total: subjTasks.length,
      done: subjDone,
    };
  }).filter((s) => s.total > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-700">
            04. Đánh giá &amp; Thống kê
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Khảo sát &amp; Thống kê tiến độ
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Theo dõi sự tiến bộ trong thói quen tự học, tỷ lệ hoàn thành nhiệm vụ và gửi
            báo cáo tổng hợp qua Gmail hoặc Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onChangeSubTab("survey")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "survey"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Khảo sát tự học</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab("stats")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "stats"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Thống kê tiến độ</span>
          </button>
        </div>
      </div>

      {activeSubTab === "survey" ? (
        <div className="grid gap-8 lg:grid-cols-12">
          <form
            onSubmit={handleSurveySubmit}
            className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Khảo sát thói quen học tập
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Đánh giá mức độ đồng ý theo thang điểm 1 đến 5
                </p>
              </div>
              <button
                type="button"
                onClick={onCreateSurveyForm}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tạo Google Form khảo sát
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {SURVEY_QUESTIONS.map((q, index) => (
                <div key={index}>
                  <label
                    htmlFor={`survey-q-${index}`}
                    className="block text-sm font-medium text-slate-900"
                  >
                    <span className="font-mono-tabular mr-1.5 text-slate-400">
                      0{index + 1}.
                    </span>
                    {q}
                  </label>
                  <select
                    id={`survey-q-${index}`}
                    value={scores[index]}
                    onChange={(e) =>
                      handleScoreChange(index, Number(e.target.value))
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                  >
                    {SURVEY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value} — {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div>
                <label
                  htmlFor="survey-reflection"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nhận xét tự phản ánh của em (tùy chọn)
                </label>
                <textarea
                  id="survey-reflection"
                  rows={3}
                  maxLength={FIELD_LIMITS.reflection}
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder="Thói quen nào em muốn cải thiện trong tuần tới?"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {surveyError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {surveyError}
                </p>
              )}
              {surveyNotice && (
                <p className="rounded-lg bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                  {surveyNotice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
              >
                {submitting ? "Đang lưu..." : "Gửi khảo sát"}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Lịch sử tự đánh giá ({surveys.length})
            </h3>
            {surveys.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Chưa có lượt khảo sát nào được ghi nhận. Hoàn thành bảng bên trái để theo
                dõi điểm trung bình qua từng giai đoạn.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {surveys.slice(0, 8).map((item, idx) => (
                  <li key={item.id} className="py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Lần đánh giá #{surveys.length - idx}
                      </span>
                      <span className="font-mono-tabular text-sm font-bold text-sky-700">
                        {item.averageScore.toFixed(2)} / 5.00
                      </span>
                    </div>
                    {item.reflection && (
                      <p className="mt-1.5 text-xs text-slate-600">
                        {item.reflection}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        /* STATISTICS */
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Tổng nhiệm vụ</p>
              <p className="font-mono-tabular mt-2 text-3xl font-bold text-slate-900">
                {totalTasks}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Đã hoàn thành</p>
              <p className="font-mono-tabular mt-2 text-3xl font-bold text-teal-700">
                {doneTasks}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">Lượt Think First</p>
              <p className="font-mono-tabular mt-2 text-3xl font-bold text-sky-700">
                {thinkEntries.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-medium text-slate-500">
                Tự đánh giá &amp; Kiểm chứng
              </p>
              <p className="font-mono-tabular mt-2 text-3xl font-bold text-slate-900">
                {selfTests.length + factChecks.length}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">
                  Tiến độ hoàn thành kế hoạch
                </h3>
                <span className="font-mono-tabular text-sm font-bold text-teal-700">
                  {progressPercent}% hoàn thành
                </span>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <h4 className="mt-6 text-xs font-semibold text-slate-700">
                Phân bổ theo môn học
              </h4>
              {subjectStats.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Chưa có dữ liệu môn học trong Study Plan.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {subjectStats.map((s) => {
                    const pct = Math.round((s.done / s.total) * 100);
                    return (
                      <div key={s.subject}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800">{s.subject}</span>
                          <span className="font-mono-tabular text-slate-500">
                            {s.done}/{s.total} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-sky-600"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5">
              <h3 className="text-base font-semibold text-slate-900">
                Chia sẻ báo cáo học tập
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Gửi tổng hợp tiến độ tự học qua Gmail cho giáo viên chủ nhiệm/phụ huynh
                hoặc xuất bảng thống kê sang Google Sheets.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="report-email"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Email người nhận báo cáo
                  </label>
                  <input
                    id="report-email"
                    type="email"
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    placeholder="giaovien@example.com"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSendEmailReport(reportEmail)}
                    className="inline-flex items-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-800 whitespace-nowrap cursor-pointer"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Gửi báo cáo qua Gmail</span>
                  </button>
                  <button
                    type="button"
                    onClick={onExportSheetsReport}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-teal-700" />
                    <span>Xuất Google Sheets</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
