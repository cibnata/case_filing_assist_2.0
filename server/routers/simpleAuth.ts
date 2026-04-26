/**
 * 簡易登入 Router（開發 / 測試用）
 * 帳號：test  密碼：test  → 直接進入，不走 Manus OAuth
 * 任何帳號密碼相同時亦可登入（方便多人測試）
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT } from "jose";
import { publicProcedure, router } from "../_core/trpc";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { ENV } from "../_core/env";
import { upsertUser, getUserByOpenId } from "../db";

/** 取得 JWT 簽名 Key（與 sdk.ts 相同邏輯） */
function getSecretKey() {
  const secret = ENV.cookieSecret || "dev-secret-fallback-do-not-use-in-production";
  return new TextEncoder().encode(secret);
}

/** 簽發 session JWT */
async function signSession(payload: { openId: string; appId: string; name: string }) {
  const expiresInMs = ONE_YEAR_MS;
  const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
  return new SignJWT({
    openId: payload.openId,
    appId: payload.appId,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSecretKey());
}

export const simpleAuthRouter = router({
  /**
   * 簡易登入
   * - 帳號 test + 密碼 test → 以管理員身分登入
   * - 其他帳號密碼相同時 → 以一般員警身分登入
   */
  login: publicProcedure
    .input(z.object({
      username: z.string().min(1).max(64),
      password: z.string().min(1).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const { username, password } = input;

      // 驗證：密碼必須與帳號相同，或使用 test/test
      const isTestAccount = username === "test" && password === "test";
      const isSelfMatch = username === password;

      if (!isTestAccount && !isSelfMatch) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "帳號或密碼錯誤",
        });
      }

      // 建立或取得使用者（openId 以帳號名稱作為識別）
      const openId = `simple:${username}`;
      const displayName = username === "test" ? "測試員警" : username;
      const isAdmin = username === "test";

      // 確保使用者存在於資料庫
      let user = await getUserByOpenId(openId);
      if (!user) {
        await upsertUser({
          openId,
          name: displayName,
          email: null,
          loginMethod: "simple",
          role: isAdmin ? "admin" : "user",
          lastSignedIn: new Date(),
        });
        user = await getUserByOpenId(openId);
      } else {
        // 更新最後登入時間
        await upsertUser({
          openId,
          lastSignedIn: new Date(),
        });
      }

      if (!user) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "無法建立使用者" });
      }

      // 簽發 JWT session cookie
      const appId = ENV.appId || "police-case-filing";
      const token = await signSession({ openId, appId, name: displayName });

      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          openId: user.openId,
        },
      };
    }),
});
