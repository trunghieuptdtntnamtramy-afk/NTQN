import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = "gemini-4-hydrogen";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY chưa được cấu hình trên máy chủ.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getErrorStatus(error: unknown): { status: number; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message: "API key không hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra trong Settings > Secrets.",
    };
  }
  if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "Hệ thống đang tạm quá tải hạn mức gọi AI. Vui lòng thử lại sau ít phút.",
    };
  }
  return {
    status: 500,
    message: msg || "Đã xảy ra lỗi khi xử lý yêu cầu AI.",
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // 1. AI Coach (Socratic Tutor with High Thinking)
  app.post("/api/ai/coach", async (req: Request, res: Response) => {
    try {
      const { question, initialThinking, subject, confidence, history } = req.body ?? {};
      if (typeof question !== "string" || !question.trim()) {
        res.status(400).json({ error: "Vui lòng nhập câu hỏi hoặc vấn đề học tập." });
        return;
      }

      const ai = getAiClient();
      const historyText = Array.isArray(history)
        ? history
            .slice(-6)
            .map((m: { role?: string; text?: string }) =>
              `${m.role === "user" ? "Học sinh" : "AI Coach"}: ${String(m.text || "").slice(0, 1200)}`
            )
            .join("\n")
        : "";

      const prompt = [
        `Môn học: ${String(subject || "Tổng hợp").slice(0, 60)}`,
        `Mức độ tự tin của học sinh: ${String(confidence || "Chưa rõ").slice(0, 60)}`,
        initialThinking
          ? `Suy nghĩ & lập luận ban đầu (Think First) của học sinh:\n${String(initialThinking).slice(0, 3000)}`
          : "Học sinh chưa ghi nhận phần Think First.",
        historyText ? `Lịch sử trao đổi gần đây:\n${historyText}` : "",
        `Câu hỏi hiện tại của học sinh:\n${question.trim().slice(0, 2000)}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "Bạn là AI Coach của nền tảng EDU SMART dành cho học sinh Trường PTDTNT THPT Quảng Nam. " +
            "Nhiệm vụ của bạn là đóng vai người thầy hướng dẫn theo phương pháp Socratic: " +
            "1) Ghi nhận và nhận xét điểm hợp lý hoặc lỗ hổng trong suy nghĩ ban đầu của học sinh (nếu có). " +
            "2) KHÔNG đưa ngay đáp án cuối cùng. Thay vào đó, chia bài toán/vấn đề thành 2-3 bước gợi mở rõ ràng và đặt câu hỏi dẫn dắt để học sinh tự suy luận. " +
            "3) Dùng tiếng Việt chuẩn mực, thân thiện, khích lệ tinh thần tự học và kiểm chứng lại kết quả. Trình bày súc tích, dễ đọc.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      res.json({ reply: response.text ?? "" });
    } catch (error) {
      console.error("AI Coach error:", error);
      const { status, message } = getErrorStatus(error);
      res.status(status).json({ error: message });
    }
  });

  // 2. Fact Check (Search Grounding + High Thinking)
  app.post("/api/ai/fact-check", async (req: Request, res: Response) => {
    try {
      const { claim, source } = req.body ?? {};
      if (typeof claim !== "string" || !claim.trim()) {
        res.status(400).json({ error: "Vui lòng nhập thông tin cần kiểm chứng." });
        return;
      }

      const ai = getAiClient();
      const prompt = [
        `Thông tin cần kiểm chứng:\n"${claim.trim().slice(0, 2000)}"`,
        source && String(source).trim()
          ? `Nguồn học sinh đang tham khảo: ${String(source).trim().slice(0, 500)}`
          : "Học sinh chưa cung cấp nguồn tham khảo.",
        "Hãy đối chiếu với kiến thức khoa học/sách giáo khoa và tìm kiếm xác thực từ nguồn uy tín. Trình bày theo 3 phần ngắn gọn: (1) Kết luận độ tin cậy (Đáng tin cậy / Cần kiểm tra thêm / Chưa chính xác), (2) Phân tích & đối chiếu bằng chứng, (3) Khuyên học sinh cách tự đối chiếu nguồn gốc.",
      ].join("\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "Bạn là chuyên gia thẩm định học liệu học đường tại EDU SMART. Luôn kiểm chứng cẩn trọng bằng tiếng Việt, chỉ rõ điểm đúng/sai và trích dẫn nguồn xác thực.",
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks
        .map((chunk) => chunk.web)
        .filter((web): web is { uri: string; title?: string } => Boolean(web?.uri))
        .map((web) => ({
          uri: web.uri,
          title: web.title || web.uri,
        }));

      res.json({
        analysis: response.text ?? "",
        sources,
      });
    } catch (error) {
      console.error("Fact Check error:", error);
      const { status, message } = getErrorStatus(error);
      res.status(status).json({ error: message });
    }
  });

  // 3. Self Test Reviewer (Feynman Technique Structured Evaluation)
  app.post("/api/ai/self-test-review", async (req: Request, res: Response) => {
    try {
      const { topic, subject, ownExplanation, application } = req.body ?? {};
      if (
        typeof ownExplanation !== "string" ||
        !ownExplanation.trim() ||
        typeof application !== "string" ||
        !application.trim()
      ) {
        res.status(400).json({ error: "Vui lòng hoàn thành cả phần diễn giải kiến thức và vận dụng thực tế." });
        return;
      }

      const ai = getAiClient();
      const prompt = [
        `Môn học: ${String(subject || "Tổng hợp").slice(0, 60)}`,
        `Chủ đề: ${String(topic || "Kiến thức vừa học").slice(0, 200)}`,
        `Phần diễn giải bằng ngôn ngữ của học sinh:\n${ownExplanation.trim().slice(0, 3500)}`,
        `Phần ví dụ/tình huống vận dụng của học sinh:\n${application.trim().slice(0, 3500)}`,
      ].join("\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            "Bạn là giáo viên đánh giá theo phương pháp Feynman tại Trường PTDTNT THPT Quảng Nam. Nhận xét chân thành, khích lệ bằng tiếng Việt.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              clarityLevel: {
                type: Type.STRING,
                description: "Mức độ hiểu bài ngắn gọn (ví dụ: Vững vàng, Khá tốt, Cần củng cố thêm).",
              },
              strengths: {
                type: Type.STRING,
                description: "Điểm mạnh trong cách diễn giải và vận dụng của học sinh.",
              },
              missingConcepts: {
                type: Type.STRING,
                description: "Những ý hoặc liên hệ thực tế cần bổ sung để hiểu sâu hơn.",
              },
              nextPracticeQuestion: {
                type: Type.STRING,
                description: "Một câu hỏi thử thách tiếp theo để học sinh tự kiểm tra lại.",
              },
            },
            required: ["clarityLevel", "strengths", "missingConcepts", "nextPracticeQuestion"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (error) {
      console.error("Self Test Review error:", error);
      const { status, message } = getErrorStatus(error);
      res.status(status).json({ error: message });
    }
  });

  // 4. Study Plan Task Suggestions
  app.post("/api/ai/study-suggestions", async (req: Request, res: Response) => {
    try {
      const { subject, goal } = req.body ?? {};
      if (typeof goal !== "string" || !goal.trim()) {
        res.status(400).json({ error: "Vui lòng nhập mục tiêu học tập." });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Môn học: ${String(subject || "Toán học").slice(0, 60)}. Mục tiêu của học sinh: ${goal.trim().slice(0, 400)}. Hãy đề xuất đúng 3 nhiệm vụ tự học cụ thể, khả thi trong tuần.`,
        config: {
          systemInstruction:
            "Bạn hỗ trợ học sinh THPT lập kế hoạch tự học rõ ràng, chia nhỏ đầu việc bằng tiếng Việt.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: {
                  type: Type.STRING,
                  description: "Tên nhiệm vụ ngắn gọn dưới 120 ký tự.",
                },
                notes: {
                  type: Type.STRING,
                  description: "Gợi ý cách thực hiện và tự kiểm tra.",
                },
              },
              required: ["title", "notes"],
            },
          },
        },
      });

      const tasks = JSON.parse((response.text ?? "[]").trim());
      res.json({ tasks: Array.isArray(tasks) ? tasks.slice(0, 3) : [] });
    } catch (error) {
      console.error("Study Suggestions error:", error);
      const { status, message } = getErrorStatus(error);
      res.status(status).json({ error: message });
    }
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`EDU SMART server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
