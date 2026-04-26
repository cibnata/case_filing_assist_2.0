import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createCase,
  getCasesByOfficer,
  getAllCases,
  getCaseById,
  getCaseByQrToken,
  updateCaseStatus,
  updateCaseNotes,
  createReporter,
  getReporterByCaseId,
  createEvidenceFile,
  getEvidenceFilesByCaseId,
  getOcrResultByCaseId,
  getIntelReportByCaseId,
  getWalletProfilesByCaseId,
  updateUserProfile,
} from "../db";
import { notifyOwner } from "../_core/notification";
import { storagePut } from "../storage";

// 產生案件編號：格式 YYYYMMDD-UNIT-NNNN
function generateCaseNumber(unit: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const unitCode = unit.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "").slice(0, 6);
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${date}-${unitCode}-${rand}`;
}

export const casesRouter = router({
  // ─── 更新員警個人資料 ────────────────────────────────────────────────────
  updateProfile: protectedProcedure
    .input(z.object({
      unit: z.string().min(1),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  // ─── 建案 ────────────────────────────────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const officer = ctx.user;
      const officerUnit = (officer as any).unit || "未設定單位";
      const officerName = officer.name || "未知員警";
      const caseNumber = generateCaseNumber(officerUnit);
      const qrToken = uuidv4();

      const newCase = await createCase({
        caseNumber,
        qrToken,
        officerId: officer.id,
        officerName,
        officerUnit,
        status: "pending",
        notes: input.notes,
      });

      return { case: newCase, qrToken };
    }),

  // ─── 取得 QR Code 圖片（Base64 Data URL） ───────────────────────────────
  getQrCode: protectedProcedure
    .input(z.object({ caseId: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.caseId);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // QR Code 指向報案人填寫頁面
      const reportUrl = `${process.env.VITE_APP_URL || ""}/report/${c.qrToken}`;
      const qrDataUrl = await QRCode.toDataURL(reportUrl, {
        width: 300,
        margin: 2,
        color: { dark: "#1a1a2e", light: "#ffffff" },
      });
      return { qrDataUrl, reportUrl, caseNumber: c.caseNumber };
    }),

  // ─── 案件列表（員警只看自己的，admin 看全部） ────────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") {
      return getAllCases();
    }
    return getCasesByOfficer(ctx.user.id);
  }),

  // ─── 案件詳情 ─────────────────────────────────────────────────────────────
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const c = await getCaseById(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const reporter = await getReporterByCaseId(input.id);
      const files = await getEvidenceFilesByCaseId(input.id);
      const ocr = await getOcrResultByCaseId(input.id);
      const intel = await getIntelReportByCaseId(input.id);
      const wallets = await getWalletProfilesByCaseId(input.id);
      return { case: c, reporter, files, ocr, intel, wallets };
    }),

  // ─── 更新案件狀態 ─────────────────────────────────────────────────────────
  updateStatus: protectedProcedure
    .input(z.object({ id: z.number(), status: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updateCaseStatus(input.id, input.status);
      return { success: true };
    }),

  // ─── 更新案件備註 ─────────────────────────────────────────────────────────
  updateNotes: protectedProcedure
    .input(z.object({ id: z.number(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const c = await getCaseById(input.id);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      if (c.officerId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await updateCaseNotes(input.id, input.notes);
      return { success: true };
    }),

  // ─── 公開：驗證 QR Token ─────────────────────────────────────────────────
  validateQrToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const c = await getCaseByQrToken(input.token);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "無效的報案連結" });
      if (c.status !== "pending") {
        return {
          valid: false,
          message: "此案件已完成報案資料填寫",
          caseNumber: c.caseNumber,
        };
      }
      return {
        valid: true,
        caseNumber: c.caseNumber,
        officerName: c.officerName,
        officerUnit: c.officerUnit,
      };
    }),

  // ─── 公開：報案人提交基本資料 ────────────────────────────────────────────
  submitReporter: publicProcedure
    .input(z.object({
      token: z.string(),
      name: z.string().min(1),
      idNumber: z.string().min(10).max(10),
      birthDate: z.string(),
      address: z.string().min(1),
      caseType: z.string().min(1),
      phone: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const c = await getCaseByQrToken(input.token);
      if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "無效的報案連結" });
      if (c.status !== "pending") {
        throw new TRPCError({ code: "CONFLICT", message: "此案件已完成報案資料填寫" });
      }
      const reporter = await createReporter({
        caseId: c.id,
        name: input.name,
        idNumber: input.idNumber,
        birthDate: input.birthDate,
        address: input.address,
        caseType: input.caseType,
        phone: input.phone,
      });
      return { success: true, reporterId: reporter?.id };
    }),

  // ─── 公開：取得案件基本資訊（供報案人確認） ─────────────────────────────
  getPublicCaseInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const c = await getCaseByQrToken(input.token);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const reporter = await getReporterByCaseId(c.id);
      const files = await getEvidenceFilesByCaseId(c.id);
      return {
        caseNumber: c.caseNumber,
        officerName: c.officerName,
        officerUnit: c.officerUnit,
        status: c.status,
        reporter,
        fileCount: files.length,
      };
    }),

  // ─── 公開：報案人完成上傳，通知員警 ─────────────────────────────────────
  notifyComplete: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const c = await getCaseByQrToken(input.token);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      const reporter = await getReporterByCaseId(c.id);
      const files = await getEvidenceFilesByCaseId(c.id);

      // 更新案件狀態為 submitted
      await updateCaseStatus(c.id, "submitted");

      // 通知受理員警
      await notifyOwner({
        title: `📋 案件 ${c.caseNumber} 報案人已完成資料填寫`,
        content: `報案人：${reporter?.name || "未知"}\n案件類別：${reporter?.caseType || "未知"}\n上傳證物：${files.length} 張\n請登入系統進行 OCR 辨識與情資分析。`,
      });

      return { success: true };
    }),
});
