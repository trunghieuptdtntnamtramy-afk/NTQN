import React, { useState } from "react";
import {
  CheckCircle,
  ExternalLink,
  FileText,
  PenTool,
  SearchCheck,
} from "lucide-react";
import {
  FIELD_LIMITS,
  SUBJECTS,
  type FactCheckEntry,
  type SelfTestEntry,
} from "../types/edu";

interface FactCheckAndTestModuleProps {
  activeSubTab: "check" | "test";
  onChangeSubTab: (tab: "check" | "test") => void;
  factChecks: FactCheckEntry[];
  selfTests: SelfTestEntry[];
  onSaveFactCheck: (entry: {
    claim: string;
    source: string;
    verdict?: string;
    reliability: "pending" | "verified" | "needs_review" | "inaccurate";
  }) => Promise<void>;
  onSaveSelfTest: (entry: {
    topic: string;
    subject: string;
    ownExplanation: string;
    application: string;
    aiFeedback?: string;
  }) => Promise<void>;
  onExportDoc: (title: string, content: string) => void;
}

interface GroundedSource {
  uri: string;
  title: string;
}

interface SelfTestReview {
  clarityLevel: string;
  strengths: string;
  missingConcepts: string;
  nextPracticeQuestion: string;
}

export const FactCheckAndTestModule: React.FC<FactCheckAndTestModuleProps> = ({
  activeSubTab,
  onChangeSubTab,
  factChecks,
  selfTests,
  onSaveFactCheck,
  onSaveSelfTest,
  onExportDoc,
}) => {
  // Fact check state
  const [claim, setClaim] = useState("");
  const [source, setSource] = useState("");
  const [reliability, setReliability] = useState<
    "pending" | "verified" | "needs_review" | "inaccurate"
  >("needs_review");
  const [factLoading, setFactLoading] = useState(false);
  const [factAnalysis, setFactAnalysis] = useState<string | null>(null);
  const [factSources, setFactSources] = useState<GroundedSource[]>([]);
  const [factError, setFactError] = useState<string | null>(null);
  const [factNotice, setFactNotice] = useState<string | null>(null);

  // Self test state
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [ownExplanation, setOwnExplanation] = useState("");
  const [application, setApplication] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testReview, setTestReview] = useState<SelfTestReview | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<string | null>(null);

  const handleFactVerifyAndSave = async (useAi: boolean) => {
    setFactError(null);
    setFactNotice(null);
    if (!claim.trim()) {
      setFactError("Vui lòng nhập thông tin hoặc nhận định cần kiểm chứng.");
      return;
    }

    setFactLoading(true);
    try {
      let analysisText = "";
      let grounded: GroundedSource[] = [];

      if (useAi) {
        const res = await fetch("/api/ai/fact-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claim: claim.trim(), source: source.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Không thể đối chiếu thông tin.");
        }
        analysisText = String(data.analysis || "");
        grounded = Array.isArray(data.sources) ? data.sources : [];
        setFactAnalysis(analysisText);
        setFactSources(grounded);
      }

      await onSaveFactCheck({
        claim: claim.trim().slice(0, FIELD_LIMITS.claim),
        source: source.trim().slice(0, FIELD_LIMITS.source),
        verdict: analysisText ? analysisText.slice(0, FIELD_LIMITS.aiText) : undefined,
        reliability,
      });

      setFactNotice(
        useAi
          ? "Đã đối chiếu nguồn trực tuyến và lưu kết quả kiểm chứng."
          : "Đã lưu nội dung kiểm chứng vào nhật ký học tập."
      );
    } catch (err) {
      setFactError(err instanceof Error ? err.message : "Lỗi xử lý kiểm chứng.");
    } finally {
      setFactLoading(false);
    }
  };

  const handleSelfTestSubmit = async (evaluateWithAi: boolean) => {
    setTestError(null);
    setTestNotice(null);
    if (!ownExplanation.trim() || !application.trim()) {
      setTestError("Hãy hoàn thành cả phần diễn giải bằng ngôn ngữ của em và phần vận dụng.");
      return;
    }

    setTestLoading(true);
    try {
      let feedbackSummary = "";
      if (evaluateWithAi) {
        const res = await fetch("/api/ai/self-test-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim() || "Kiến thức vừa học",
            subject,
            ownExplanation: ownExplanation.trim(),
            application: application.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Không thể đánh giá bài tự kiểm tra.");
        }
        setTestReview(data);
        feedbackSummary = `Mức độ hiểu bài: ${data.clarityLevel}\nĐiểm mạnh: ${data.strengths}\nCần bổ sung: ${data.missingConcepts}\nCâu hỏi thử thách: ${data.nextPracticeQuestion}`;
      }

      await onSaveSelfTest({
        topic: (topic.trim() || `Tự kiểm tra ${subject}`).slice(0, FIELD_LIMITS.topic),
        subject,
        ownExplanation: ownExplanation.trim().slice(0, FIELD_LIMITS.explanation),
        application: application.trim().slice(0, FIELD_LIMITS.application),
        aiFeedback: feedbackSummary
          ? feedbackSummary.slice(0, FIELD_LIMITS.aiText)
          : undefined,
      });

      setTestNotice("Đã ghi nhận bài tự đánh giá kiến thức của em.");
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Không thể lưu tự đánh giá.");
    } finally {
      setTestLoading(false);
    }
  };

  const reliabilityLabel = (val: FactCheckEntry["reliability"]) => {
    switch (val) {
      case "verified":
        return "Đáng tin cậy";
      case "needs_review":
        return "Cần đối chiếu thêm";
      case "inaccurate":
        return "Chưa chính xác";
      default:
        return "Chờ kiểm chứng";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sky-700">
            03. Kiểm chứng &amp; Củng cố
          </p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            Fact Check &amp; Self Test
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Kiểm chứng độ chính xác của thông tin từ AI hoặc mạng xã hội trước khi trích
            dẫn, đồng thời tự kiểm tra mức độ hiểu bài theo kỹ thuật Feynman.
          </p>
        </div>

        <div className="flex items-center gap-1 self-start rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onChangeSubTab("check")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "check"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <SearchCheck className="h-3.5 w-3.5" />
            <span>Fact Check</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab("test")}
            className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSubTab === "test"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            <span>Self Test</span>
          </button>
        </div>
      </div>

      {activeSubTab === "check" ? (
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-base font-semibold text-slate-900">
                Kiểm chứng thông tin &amp; đối chiếu nguồn
              </h3>

              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="fact-claim"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Thông tin hoặc nhận định cần kiểm chứng
                  </label>
                  <textarea
                    id="fact-claim"
                    rows={4}
                    maxLength={FIELD_LIMITS.claim}
                    value={claim}
                    onChange={(e) => setClaim(e.target.value)}
                    placeholder="Dán đoạn thông tin, số liệu hoặc câu trả lời AI muốn kiểm chứng..."
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fact-source"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Nguồn tham khảo (SGK, trang web...)
                    </label>
                    <input
                      id="fact-source"
                      type="text"
                      maxLength={FIELD_LIMITS.source}
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Ví dụ: SGK Ngữ văn 11 hoặc liên kết web"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="fact-reliability"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Đánh giá ban đầu của em
                    </label>
                    <select
                      id="fact-reliability"
                      value={reliability}
                      onChange={(e) =>
                        setReliability(
                          e.target.value as FactCheckEntry["reliability"]
                        )
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-600 focus:outline-none"
                    >
                      <option value="needs_review">Cần đối chiếu thêm</option>
                      <option value="verified">Đáng tin cậy</option>
                      <option value="inaccurate">Chưa chính xác</option>
                      <option value="pending">Chờ kiểm chứng</option>
                    </select>
                  </div>
                </div>

                {factError && (
                  <p className="text-xs font-medium text-red-600" role="alert">
                    {factError}
                  </p>
                )}
                {factNotice && (
                  <p className="rounded-lg bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                    {factNotice}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={factLoading}
                    onClick={() => handleFactVerifyAndSave(true)}
                    className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                  >
                    {factLoading
                      ? "Đang đối chiếu nguồn..."
                      : "Đối chiếu bằng Google Search & Lưu"}
                  </button>
                  <button
                    type="button"
                    disabled={factLoading}
                    onClick={() => handleFactVerifyAndSave(false)}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                  >
                    Chỉ lưu nội dung kiểm chứng
                  </button>
                </div>
              </div>

              {factAnalysis && (
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Kết quả đối chiếu nguồn tham khảo
                  </h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {factAnalysis}
                  </p>
                  {factSources.length > 0 && (
                    <div className="mt-4 border-t border-slate-200 pt-3">
                      <p className="text-xs font-semibold text-slate-700">
                        Nguồn tìm kiếm xác thực:
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {factSources.slice(0, 5).map((s, idx) => (
                          <li key={idx}>
                            <a
                              href={s.uri}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate max-w-md">{s.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="aspect-4/3 w-full overflow-hidden bg-slate-100">
                <img
                  src="/src/assets/images/card_fact_check_1795454711506.jpg"
                  alt="Sách giáo khoa và thẻ ghi chú đối chiếu thông tin học tập"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Lịch sử kiểm chứng ({factChecks.length})
                </h3>
                {factChecks.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Chưa có mục kiểm chứng nào được lưu.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {factChecks.slice(0, 5).map((item) => (
                      <li key={item.id} className="py-3">
                        <p className="text-xs font-semibold text-slate-900 line-clamp-2">
                          {item.claim}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{reliabilityLabel(item.reliability)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">
                            {item.source || "Chưa ghi nguồn"}
                          </span>
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
        /* SELF TEST */
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <h3 className="text-base font-semibold text-slate-900">
              Tự đánh giá theo phương pháp Feynman
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Giải thích lại kiến thức vừa học bằng lời văn của chính em và nêu tình huống
              vận dụng thực tế.
            </p>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="test-topic"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Chủ đề / Bài học
                  </label>
                  <input
                    id="test-topic"
                    type="text"
                    maxLength={FIELD_LIMITS.topic}
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Ví dụ: Định luật bảo toàn cơ năng"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="test-subject"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Môn học
                  </label>
                  <select
                    id="test-subject"
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
              </div>

              <div>
                <label
                  htmlFor="test-explanation"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Trình bày kiến thức bằng ngôn ngữ của em
                </label>
                <textarea
                  id="test-explanation"
                  rows={4}
                  maxLength={FIELD_LIMITS.explanation}
                  value={ownExplanation}
                  onChange={(e) => setOwnExplanation(e.target.value)}
                  placeholder="Nếu phải giảng lại cho một bạn cùng lớp hiểu, em sẽ giải thích khái niệm này thế nào?"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="test-application"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Tình huống vận dụng thực tế
                </label>
                <textarea
                  id="test-application"
                  rows={3}
                  maxLength={FIELD_LIMITS.application}
                  value={application}
                  onChange={(e) => setApplication(e.target.value)}
                  placeholder="Em có thể áp dụng kiến thức này để giải quyết vấn đề hay bài toán nào trong thực tiễn?"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:outline-none"
                />
              </div>

              {testError && (
                <p className="text-xs font-medium text-red-600" role="alert">
                  {testError}
                </p>
              )}
              {testNotice && (
                <p className="rounded-lg bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                  {testNotice}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={testLoading}
                  onClick={() => handleSelfTestSubmit(true)}
                  className="rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {testLoading ? "Đang đánh giá..." : "Hoàn thành & Nhận phản hồi AI"}
                </button>
                <button
                  type="button"
                  disabled={testLoading}
                  onClick={() => handleSelfTestSubmit(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  Lưu tự đánh giá
                </button>
              </div>
            </div>

            {testReview && (
              <div className="mt-6 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
                <div className="flex items-center gap-2 font-semibold text-teal-800">
                  <CheckCircle className="h-4 w-4" />
                  <span>Đánh giá mức độ nắm vững: {testReview.clarityLevel}</span>
                </div>
                <p className="text-slate-700">
                  <strong className="text-slate-900">Điểm mạnh: </strong>
                  {testReview.strengths}
                </p>
                <p className="text-slate-700">
                  <strong className="text-slate-900">Gợi ý bổ sung: </strong>
                  {testReview.missingConcepts}
                </p>
                <p className="text-slate-700">
                  <strong className="text-slate-900">Thử thách tiếp theo: </strong>
                  {testReview.nextPracticeQuestion}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Bài tự đánh giá đã lưu ({selfTests.length})
            </h3>
            {selfTests.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Chưa có bài tự đánh giá nào. Khi hoàn thành, em có thể xuất ghi chú sang
                Google Docs để ôn tập trước kỳ thi.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {selfTests.slice(0, 6).map((item) => (
                  <li key={item.id} className="py-3.5">
                    <p className="text-sm font-semibold text-slate-900">{item.topic}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.subject}</p>
                    <p className="mt-1.5 text-xs text-slate-600 line-clamp-2">
                      {item.ownExplanation}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        onExportDoc(
                          `Self Test - ${item.topic}`,
                          `Môn học: ${item.subject}\nChủ đề: ${item.topic}\n\nDiễn giải của học sinh:\n${item.ownExplanation}\n\nVận dụng thực tế:\n${item.application}\n\nPhản hồi:\n${item.aiFeedback || "Tự đánh giá"}`
                        )
                      }
                      className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5 text-sky-700" />
                      <span>Xuất sang Google Docs</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
