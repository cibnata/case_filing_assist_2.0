import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  getCaseById,
  getReporterByCaseId,
  getIntelReportByCaseId,
  getOcrResultByCaseId,
  upsertInterrogationRecord,
  getInterrogationRecordByCaseId,
  updateCaseStatus,
} from "../db";

// ─── 固定問項（依調查筆錄範本） ─────────────────────────────────────────────
const FIXED_QUESTIONS = [
  {
    id: 1,
    type: "fixed" as const,
    question: "上述年籍資料是否為你本人？",
    defaultAnswer: "是我本人資料無誤。",
  },
  {
    id: 2,
    type: "fixed" as const,
    question:
      "為利本案調查程序，並維護你的司法權益，有關你於警詢筆錄內所登載之現住地，將以你目前較常居住之地點為主（即接受警方通知後，方便前往釐清案情或提供佐證資料之地點），警方後續如有案情進展或偵查需求，將即時通知你前往該地點所在地之警察機關協助接受警詢或提供相關資料，對於前述內容你是否清楚？你目前的現住地是否與調查筆錄登載內容一致？",
    defaultAnswer: "清楚。一致。",
  },
  {
    id: 3,
    type: "fixed" as const,
    question: "你今日因何事至所製作筆錄？",
    defaultAnswer: "我因遭人詐騙，故至本所報案。",
  },
  {
    id: 4,
    type: "fixed" as const,
    question: "你於何時？何地？遭何人詐騙？請詳述詐騙之過程。",
    defaultAnswer: "", // 由 LLM 依情資填入
  },
  {
    id: 5,
    type: "fixed" as const,
    question: "歹徒提供投資網站名稱為何？網址為？有無提供 APP 下載連結？",
    defaultAnswer: "", // 由 LLM 依情資填入
  },
];

export const interrogationRouter = router({
  // ─── 產生筆錄 ────────────────────────────────────────────────────────────
  generate: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const reporter = await getReporterByCaseId(input.caseId);
      const intel = await getIntelReportByCaseId(input.caseId);
      const ocr = await getOcrResultByCaseId(input.caseId);

      // 標記為產生中
      await upsertInterrogationRecord(input.caseId, {
        status: "generating",
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
      });

      // 組合情資摘要供 LLM 參考
      const intelSummary = intel ? JSON.stringify({
        caseSummary: intel.caseSummary,
        victim: intel.victim,
        suspects: intel.suspects,
        relatedAccounts: intel.relatedAccounts,
        timeline: intel.timeline,
        walletAddresses: intel.walletAddresses,
      }, null, 2) : "（尚無情資分析結果）";

      const ocrText = ocr?.confirmedText || ocr?.rawText || "（尚無 OCR 辨識文字）";

      const reporterInfo = reporter ? `
姓名：${reporter.name}
身分證字號：${reporter.idNumber}
出生日期：${reporter.birthDate}
現住地址：${reporter.address}
戶籍地址：${reporter.registeredAddress || reporter.address}
電話：${reporter.phone || "未填"}
性別：${reporter.gender || "未填"}
出生地：${reporter.birthPlace || "未填"}
職業：${reporter.occupation || "未填"}
教育程度：${reporter.education || "未填"}
家庭經濟狀況：${reporter.economicStatus || "未填"}
報案類別：${reporter.caseType}
` : "（尚無報案人資料）";

      const systemPrompt = `你是一位專業的警察調查筆錄撰寫助理，精通台灣警察調查筆錄的格式與用語。
你的任務是根據提供的被害人基本資料、OCR 辨識文字及情資分析結果，產生一份完整的調查筆錄問答。

筆錄格式規則：
1. 問答使用「問」「答」格式
2. 語氣正式、用詞精確，符合警察書面語言
3. 答案應完整、具體，包含時間、地點、金額、帳號等關鍵細節
4. 固定問項的答案需根據實際案情填入，不可空白
5. AI 建議追問應針對案件中尚未釐清的重要情資提問

請以 JSON 格式輸出，結構如下：
{
  "questions": [
    {
      "id": 1,
      "type": "fixed",
      "question": "問題內容",
      "answer": "答案內容",
      "editable": true
    },
    ...
    {
      "id": 6,
      "type": "ai_suggested",
      "question": "AI 建議追問內容",
      "answer": "建議答案或空白",
      "editable": true
    }
  ]
}`;

      const userPrompt = `請根據以下資料產生調查筆錄問答：

【被害人基本資料】
${reporterInfo}

【案件 OCR 辨識文字（證物截圖內容）】
${ocrText}

【情資分析結果】
${intelSummary}

【固定問項（必須包含，依序為問1至問5）】
問1：上述年籍資料是否為你本人？
問2：（司法通知說明及現住地確認）
問3：你今日因何事至所製作筆錄？
問4：你於何時？何地？遭何人詐騙？請詳述詐騙之過程。
問5：歹徒提供投資網站名稱為何？網址為？有無提供 APP 下載連結？

【要求】
1. 問1至問5為固定問項，必須完整填入答案（依實際案情）
2. 問4的答案需詳述詐騙過程，包含時間、地點、接觸方式、詐騙手法、損失金額等
3. 問5若無相關資訊則答「歹徒未提供投資網站」
4. 再額外產生 3 至 8 個 AI 建議追問（type: "ai_suggested"），針對：
   - 尚未釐清的通訊帳號細節
   - 銀行帳戶或轉帳細節
   - 加密貨幣錢包操作過程
   - 損失金額確認
   - 其他與本案相關的重要情資
5. AI 建議追問的答案欄位可留空（由警員詢問後填入）`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "interrogation_record",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "integer" },
                      type: { type: "string" },
                      question: { type: "string" },
                      answer: { type: "string" },
                      editable: { type: "boolean" },
                    },
                    required: ["id", "type", "question", "answer", "editable"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      const rawContent = (typeof response.choices[0]?.message?.content === 'string' ? response.choices[0]?.message?.content : null) || "{}";
      let parsed: { questions: any[] } = { questions: [] };
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // fallback：使用固定問項
        parsed.questions = FIXED_QUESTIONS.map(q => ({
          ...q,
          answer: q.defaultAnswer,
          editable: true,
        }));
      }

      await upsertInterrogationRecord(input.caseId, {
        status: "draft",
        questions: parsed.questions,
        rawGenerated: String(rawContent),
        generatedAt: new Date(),
      });

      return { success: true, questions: parsed.questions };
    }),

  // ─── 取得筆錄 ────────────────────────────────────────────────────────────
  get: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const record = await getInterrogationRecordByCaseId(input.caseId);
      const reporter = await getReporterByCaseId(input.caseId);
      return { record, reporter, case: c };
    }),

  // ─── 更新筆錄問答（警員編輯） ────────────────────────────────────────────
  update: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      questions: z.array(z.object({
        id: z.number(),
        type: z.string(),
        question: z.string(),
        answer: z.string(),
        editable: z.boolean(),
      })),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertInterrogationRecord(input.caseId, {
        questions: input.questions,
        startTime: input.startTime,
        endTime: input.endTime,
        location: input.location,
        status: "draft",
      });
      return { success: true };
    }),

  // ─── 定稿筆錄 ────────────────────────────────────────────────────────────
  finalize: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertInterrogationRecord(input.caseId, {
        status: "finalized",
        finalizedAt: new Date(),
        finalizedBy: ctx.user.id,
      });
      return { success: true };
    }),
});
