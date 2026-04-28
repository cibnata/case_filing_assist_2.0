import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import {
  getCaseById,
  getEvidenceFilesByCaseId,
  getEvidenceFileById,
  updateEvidenceFileOcr,
  upsertOcrResult,
  getOcrResultByCaseId,
  upsertIntelReport,
  getIntelReportByCaseId,
  updateCaseStatus,
} from "../db";

// ── Surya OCR 微服務位址 ─────────────────────────────────────────────────────
const SURYA_SERVICE_URL = process.env.SURYA_SERVICE_URL || "http://localhost:18765";

/**
 * 呼叫 Surya OCR 微服務對多張圖片進行批次辨識
 * 若微服務不可用，自動 fallback 到 VLM 辨識
 */
async function callSuryaOcr(imageUrls: string[]): Promise<{
  combinedText: string;
  results: Array<{ text: string; lines: Array<{ text: string; confidence: number }> }>;
  method: "surya" | "vlm";
}> {
  // 先嘗試 Surya OCR 微服務
  try {
    const resp = await fetch(`${SURYA_SERVICE_URL}/ocr/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_urls: imageUrls }),
      signal: AbortSignal.timeout(120_000), // 2 分鐘 timeout
    });

    if (!resp.ok) {
      throw new Error(`Surya 服務回應 ${resp.status}: ${await resp.text()}`);
    }

    const data = (await resp.json()) as {
      combined_text: string;
      results: Array<{ text: string; lines: Array<{ text: string; confidence: number }> }>;
    };

    return {
      combinedText: data.combined_text,
      results: data.results,
      method: "surya",
    };
  } catch (err) {
    console.warn("[OCR] Surya 微服務不可用，切換至 VLM fallback:", err);
    // fallback 到 VLM
    return callVlmOcr(imageUrls);
  }
}

/**
 * VLM 備援 OCR（使用 invokeLLM 視覺能力）
 */
async function callVlmOcr(imageUrls: string[]): Promise<{
  combinedText: string;
  results: Array<{ text: string; lines: Array<{ text: string; confidence: number }> }>;
  method: "vlm";
}> {
  const imageContents = imageUrls.map(url => ({
    type: "image_url" as const,
    image_url: { url, detail: "high" as const },
  }));

  const systemPrompt = `你是一位專業的文字辨識助理，擅長從截圖中辨識繁體中文及英文文字。
請仔細辨識所有圖片中的文字內容，包括：
- 通訊軟體對話截圖（LINE、Messenger、Telegram 等）
- 網路銀行交易截圖
- 投資平台截圖

辨識規則：
1. 完整保留所有文字，包括時間戳記、帳號、金額、網址等
2. 按圖片順序標記，格式為「=== 圖片 N ===」
3. 對話截圖需保留發話者標識
4. 數字、帳號、地址等關鍵資訊需精確辨識
5. 若圖片模糊或無法辨識，標記「[無法辨識]」`;

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: `請辨識以下 ${imageUrls.length} 張證物截圖中的所有文字內容：` },
          ...imageContents,
        ],
      },
    ],
  });

  const combinedText = (typeof response.choices[0]?.message?.content === "string"
    ? response.choices[0]?.message?.content
    : "") || "";

  // VLM 回傳整合文字，拆分為每張圖片的結果
  const parts = combinedText.split(/=== 圖片 \d+ ===/);
  const results = imageUrls.map((_, i) => ({
    text: (parts[i + 1] || "").trim(),
    lines: [],
  }));

  return { combinedText, results, method: "vlm" };
}

export const ocrRouter = router({
  // ─── 觸發 OCR 辨識（Surya OCR + VLM fallback） ──────────────────────────
  process: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const files = await getEvidenceFilesByCaseId(input.caseId);
      if (files.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "尚無證物圖片可辨識" });
      }

      // 標記為處理中
      await upsertOcrResult(input.caseId, { status: "processing" });
      await updateCaseStatus(input.caseId, "ocr_pending");

      // 建立完整圖片 URL（Surya 需要可存取的 URL）
      const appBaseUrl = process.env.APP_BASE_URL || process.env.VITE_APP_URL || "http://localhost:3000";
      const imageUrls = files.map(f => {
        const url = f.storageUrl;
        // 若已是完整 URL 則直接使用，否則加上 base URL
        if (url.startsWith("http://") || url.startsWith("https://")) return url;
        return `${appBaseUrl.replace(/\/$/, "")}${url}`;
      });

      // 呼叫 Surya OCR（自動 fallback 到 VLM）
      const ocrResult = await callSuryaOcr(imageUrls);

      // 組合每張圖片的辨識結果，加入圖片標題
      const rawTextParts = ocrResult.results.map((r, i) => {
        const fileName = files[i]?.originalName || `圖片 ${i + 1}`;
        return `=== 圖片 ${i + 1}：${fileName} ===\n${r.text || "[無法辨識]"}`;
      });
      const rawText = rawTextParts.join("\n\n");

      await upsertOcrResult(input.caseId, {
        status: "done",
        rawText,
        processedAt: new Date(),
      });
      await updateCaseStatus(input.caseId, "ocr_done");

      return {
        success: true,
        rawText,
        method: ocrResult.method,
        imageCount: files.length,
      };
    }),

  // ─── 點選單張圖片觸發 OCR 辨識 ───────────────────────────────────
  processSingle: protectedProcedure
    .input(z.object({ fileId: z.number(), caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const file = await getEvidenceFileById(input.fileId);
      if (!file || file.caseId !== input.caseId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "証物檔案不存在" });
      }
      // 標記為處理中
      await updateEvidenceFileOcr(input.fileId, { ocrStatus: "processing" });
      // 建立完整圖片 URL
      const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const imageUrl = file.storageUrl.startsWith("http")
        ? file.storageUrl
        : `${appBaseUrl.replace(/\/$/, "")}${file.storageUrl}`;
      try {
        // 先嘗試 Surya OCR
        let ocrText = "";
        try {
          const resp = await fetch(`${SURYA_SERVICE_URL}/ocr/single`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: imageUrl }),
            signal: AbortSignal.timeout(60_000),
          });
          if (resp.ok) {
            const data = (await resp.json()) as { text: string };
            ocrText = data.text || "";
          } else {
            throw new Error(`Surya 回應 ${resp.status}`);
          }
        } catch (suryaErr) {
          console.warn("[OCR] Surya 單張不可用，切換 VLM:", suryaErr);
          // fallback 到 VLM
          const vlmResp = await invokeLLM({
            messages: [
              { role: "system", content: "你是專業的文字辨識助理，請完整辨識圖片中所有文字，包括繁體中文、英文、數字、帳號、金額、時間戳記等。" },
              { role: "user", content: [{ type: "image_url", image_url: { url: imageUrl, detail: "high" } }, { type: "text", text: "請辨識此圖片中的所有文字內容：" }] },
            ],
          });
          ocrText = (typeof vlmResp.choices[0]?.message?.content === "string" ? vlmResp.choices[0]?.message?.content : "") || "";
        }
        await updateEvidenceFileOcr(input.fileId, {
          ocrStatus: "done",
          ocrText,
          ocrProcessedAt: new Date(),
        });
        // 同步更新案件層級的 OCR 合併文字
        const allFiles = await getEvidenceFilesByCaseId(input.caseId);
        const combinedParts = allFiles.map((f, i) => {
          const txt = f.id === input.fileId ? ocrText : (f.ocrText || "");
          return `=== 圖片 ${i + 1}：${f.originalName || `圖片 ${i + 1}`} ===\n${txt || "[尚未辨識]"}` ;
        });
        await upsertOcrResult(input.caseId, {
          status: "done",
          rawText: combinedParts.join("\n\n"),
          processedAt: new Date(),
        });
        return { success: true, ocrText, fileId: input.fileId };
      } catch (err) {
        await updateEvidenceFileOcr(input.fileId, { ocrStatus: "failed" });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `OCR 辨識失敗: ${err}` });
      }
    }),

    // ─── 取得 OCR 結果 ─────────────────────────────
  get: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getOcrResultByCaseId(input.caseId);
    }),

  // ─── 警員確認 OCR 全文 ───────────────────────────────────────────────────
  confirm: protectedProcedure
    .input(z.object({
      caseId: z.number(),
      confirmedText: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await upsertOcrResult(input.caseId, {
        status: "confirmed",
        confirmedText: input.confirmedText,
        confirmedAt: new Date(),
        confirmedBy: ctx.user.id,
      });
      return { success: true };
    }),

  // ─── 觸發情資分析 ────────────────────────────────────────────────────────
  analyze: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const ocr = await getOcrResultByCaseId(input.caseId);
      if (!ocr || (!ocr.confirmedText && !ocr.rawText)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "請先完成 OCR 辨識" });
      }

      await updateCaseStatus(input.caseId, "analyzing");

      const textToAnalyze = ocr.confirmedText || ocr.rawText || "";

      const systemPrompt = `你是一位專業的詐騙案件情資分析師，擅長從通訊截圖、網銀截圖等證物中萃取關鍵情資。

請從提供的文字中萃取以下情資，以 JSON 格式輸出：

{
  "caseSummary": "案件摘要（2-3句話描述詐騙手法、損失金額、主要平台）",
  "victim": {
    "name": "被害人姓名或空字串",
    "bankAccounts": ["被害人銀行帳號"],
    "contact": "聯絡方式"
  },
  "suspects": [
    {
      "alias": "歹徒使用的名稱/暱稱",
      "platform": "使用的通訊平台",
      "accounts": ["帳號列表"],
      "role": "角色描述（如：主謀、車手等）"
    }
  ],
  "relatedAccounts": [
    {
      "platform": "平台名稱（LINE/FB/IG/Telegram/銀行等）",
      "account": "帳號",
      "url": "網址或空字串",
      "type": "類型（social/bank/crypto/website）"
    }
  ],
  "timeline": [
    {
      "datetime": "時間（盡量精確到日期時間）",
      "event": "事件描述"
    }
  ],
  "walletAddresses": [
    {
      "address": "錢包地址",
      "chain": "ETH/TRON/BTC/unknown",
      "context": "出現的上下文"
    }
  ],
  "bankTransactions": [
    {
      "account": "帳號",
      "bank": "銀行名稱",
      "amount": "金額",
      "direction": "轉入/轉出",
      "date": "日期",
      "counterparty": "對方帳號或姓名"
    }
  ],
  "unverified": ["需要進一步確認的事項列表"]
}

注意事項：
- 若某欄位無相關資訊，使用空陣列或空字串
- 時序需按時間排序
- 金額需包含幣別（新台幣/USDT/ETH等）
- 加密錢包地址需完整保留`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `請分析以下詐騙案件證物文字，萃取關鍵情資：\n\n${textToAnalyze}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "intel_report",
            strict: false,
            schema: {
              type: "object",
              properties: {
                caseSummary: { type: "string" },
                victim: { type: "object" },
                suspects: { type: "array" },
                relatedAccounts: { type: "array" },
                timeline: { type: "array" },
                walletAddresses: { type: "array" },
                bankTransactions: { type: "array" },
                unverified: { type: "array" },
              },
              additionalProperties: false,
            },
          },
        },
      });

      const rawAnalysis = (typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0]?.message?.content
        : null) || "{}";

      let parsed: any = {};
      try {
        parsed = JSON.parse(rawAnalysis);
      } catch {
        parsed = { caseSummary: "分析失敗，請重試", unverified: ["LLM 輸出解析失敗"] };
      }

      await upsertIntelReport(input.caseId, {
        caseSummary: parsed.caseSummary || "",
        victim: parsed.victim || {},
        suspects: parsed.suspects || [],
        relatedAccounts: parsed.relatedAccounts || [],
        timeline: parsed.timeline || [],
        walletAddresses: parsed.walletAddresses || [],
        unverified: parsed.unverified || [],
        rawAnalysis,
        analyzedAt: new Date(),
        analyzedBy: ctx.user.id,
      });

      await updateCaseStatus(input.caseId, "analyzed");

      return { success: true, report: parsed };
    }),

  // ─── 取得情資分析結果 ────────────────────────────────────────────────────
  getIntel: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getIntelReportByCaseId(input.caseId);
    }),
});
