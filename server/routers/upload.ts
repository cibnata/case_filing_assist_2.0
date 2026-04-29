import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getCaseByQrToken, getCaseById, createEvidenceFile, getEvidenceFilesByCaseId } from "../db";
import { storagePut } from "../storage";

const evidenceUploadInput = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  base64Data: z.string(), // base64 encoded file content
  fileSize: z.number(),
});

async function saveEvidenceFile(caseId: number, input: z.infer<typeof evidenceUploadInput>) {
  // 限制檔案大小 10MB
  if (input.fileSize > 10 * 1024 * 1024) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "檔案大小不得超過 10MB" });
  }

  // 允許的圖片格式
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"];
  if (!allowedMimes.includes(input.mimeType)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "僅支援 JPEG、PNG、GIF、WebP 格式" });
  }

  // 解碼 Base64
  const base64 = input.base64Data.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");

  // 上傳至 S3
  const ext = input.fileName.split(".").pop() || "jpg";
  const storageKey = `cases/${caseId}/evidence/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { key, url } = await storagePut(storageKey, buffer, input.mimeType);

  // 儲存至資料庫
  await createEvidenceFile({
    caseId,
    storageKey: key,
    storageUrl: url,
    originalName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
  });

  return { success: true, url, key };
}

export const uploadRouter = router({
  // ─── 公開：報案人上傳證物圖片（Base64） ─────────────────────────────────
  uploadEvidence: publicProcedure
    .input(evidenceUploadInput.extend({
      token: z.string(),
    }))
    .mutation(async ({ input }) => {
      const c = await getCaseByQrToken(input.token);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "無效的報案連結" });
      if (c.status === "closed") {
        throw new TRPCError({ code: "CONFLICT", message: "此案件已不接受新的證物上傳" });
      }

      return saveEvidenceFile(c.id, input);
    }),

  // ─── 警員端：上傳案件證物圖片 ─────────────────────────────────────────────
  uploadEvidenceForCase: protectedProcedure
    .input(evidenceUploadInput.extend({
      caseId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (c.status === "closed") {
        throw new TRPCError({ code: "CONFLICT", message: "此案件已不接受新的證物上傳" });
      }

      return saveEvidenceFile(c.id, input);
    }),

  // ─── 警員端：取得案件所有證物圖片 ───────────────────────────────────────
  getEvidenceFiles: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return getEvidenceFilesByCaseId(input.caseId);
    }),
});
