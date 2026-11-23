export type ModuleId =
  | "home"
  | "study"
  | "think"
  | "coach"
  | "check"
  | "test"
  | "survey"
  | "stats"
  | "workspace"
  | "account";

export const SUBJECTS = [
  "Toán học",
  "Ngữ văn",
  "Lịch sử",
  "Địa lí",
  "Tiếng Anh",
  "Hóa học",
  "Vật lí",
  "Sinh học",
] as const;

export const CONFIDENCE_LEVELS = [
  "Rất tự tin",
  "Tương đối tự tin",
  "Chưa chắc chắn",
  "Chưa biết cách giải quyết",
] as const;

export const SURVEY_QUESTIONS = [
  "Em thường chủ động lập kế hoạch học tập.",
  "Em có thể tự giải quyết vấn đề trước khi nhờ AI.",
  "Em thường kiểm tra độ chính xác của thông tin trên mạng.",
  "Em có thể giải thích kiến thức bằng ngôn ngữ của mình.",
  "Em biết sử dụng AI như một công cụ hỗ trợ học tập.",
] as const;

export const SURVEY_OPTIONS = [
  { value: 1, label: "Hoàn toàn không đồng ý" },
  { value: 2, label: "Không đồng ý" },
  { value: 3, label: "Phân vân" },
  { value: 4, label: "Đồng ý" },
  { value: 5, label: "Hoàn toàn đồng ý" },
] as const;

export interface StudyTask {
  id: string;
  userId: string;
  title: string;
  subject: string;
  deadline: string;
  status: "pending" | "completed";
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ThinkEntry {
  id: string;
  userId: string;
  subject: string;
  question: string;
  initialThinking: string;
  confidence: (typeof CONFIDENCE_LEVELS)[number];
  aiHint?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FactCheckEntry {
  id: string;
  userId: string;
  claim: string;
  source: string;
  verdict?: string;
  reliability: "pending" | "verified" | "needs_review" | "inaccurate";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SelfTestEntry {
  id: string;
  userId: string;
  topic: string;
  subject: string;
  ownExplanation: string;
  application: string;
  aiFeedback?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SurveyResponse {
  id: string;
  userId: string;
  scores: number[];
  averageScore: number;
  reflection?: string;
  createdAt?: unknown;
}

export const FIELD_LIMITS = {
  taskTitle: 200,
  subject: 60,
  deadline: 20,
  notes: 500,
  question: 2000,
  thinking: 4000,
  claim: 2000,
  source: 500,
  topic: 200,
  explanation: 4000,
  application: 4000,
  reflection: 1000,
  aiText: 8000,
} as const;
