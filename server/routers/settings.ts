/**
 * 系統設定 Router
 * - getAll: 取得所有設定（管理員）
 * - update: 更新指定設定（管理員）
 * - getPublic: 取得非敏感設定（一般使用者，Key 遮罩處理）
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAllSystemSettings, getSystemSetting, upsertSystemSetting } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

/** 遮罩 API Key，只顯示前 4 碼與後 4 碼 */
function maskKey(value: string | null): string {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

/** 已知設定的說明對照表 */
const SETTING_DESCRIPTIONS: Record<string, string> = {
  ETHERSCAN_API_KEY: "Etherscan API Key（用於查詢以太坊錢包資料）",
  TRONSCAN_API_KEY: "Tronscan API Key（用於查詢 TRON 錢包資料）",
};

export const settingsRouter = router({
  /**
   * 取得所有設定（管理員），API Key 遮罩顯示
   */
  getAll: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "僅管理員可查看系統設定" });
    }
    const settings = await getAllSystemSettings();

    // 補充未設定的預設項目
    const defaultKeys = ["ETHERSCAN_API_KEY", "TRONSCAN_API_KEY"];
    const existingKeys = new Set(settings.map(s => s.settingKey));
    const result = [...settings];

    for (const key of defaultKeys) {
      if (!existingKeys.has(key)) {
        result.push({
          id: 0,
          settingKey: key,
          settingValue: null,
          description: SETTING_DESCRIPTIONS[key] ?? null,
          updatedAt: new Date(),
          updatedBy: null,
        });
      }
    }

    return result.map(s => ({
      ...s,
      settingValue: maskKey(s.settingValue ?? null),
      isSet: !!(s.settingValue),
    }));
  }),

  /**
   * 更新設定（管理員）
   */
  update: protectedProcedure
    .input(z.object({
      key: z.string().min(1).max(128),
      value: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "僅管理員可修改系統設定" });
      }
      const description = SETTING_DESCRIPTIONS[input.key];
      await upsertSystemSetting(input.key, input.value, description, ctx.user.id);
      return { success: true };
    }),

  /**
   * 清除設定（管理員）
   */
  clear: protectedProcedure
    .input(z.object({ key: z.string().min(1).max(128) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "僅管理員可修改系統設定" });
      }
      await upsertSystemSetting(input.key, "", SETTING_DESCRIPTIONS[input.key], ctx.user.id);
      return { success: true };
    }),

  /**
   * 取得設定狀態（是否已設定，不回傳實際值）
   * 一般登入使用者可查詢，用於前端顯示設定狀態
   */
  getStatus: protectedProcedure.query(async () => {
    const ethKey = await getSystemSetting("ETHERSCAN_API_KEY");
    const tronKey = await getSystemSetting("TRONSCAN_API_KEY");
    return {
      ETHERSCAN_API_KEY: { isSet: !!(ethKey), maskedValue: maskKey(ethKey) },
      TRONSCAN_API_KEY: { isSet: !!(tronKey), maskedValue: maskKey(tronKey) },
    };
  }),
});
