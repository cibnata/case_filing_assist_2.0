import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { casesRouter } from "./routers/cases";
import { uploadRouter } from "./routers/upload";
import { ocrRouter } from "./routers/ocr";
import { walletsRouter } from "./routers/wallets";
import { interrogationRouter } from "./routers/interrogation";
import { settingsRouter } from "./routers/settings";
import { simpleAuthRouter } from "./routers/simpleAuth";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  cases: casesRouter,
  upload: uploadRouter,
  ocr: ocrRouter,
  wallets: walletsRouter,
  interrogation: interrogationRouter,
  settings: settingsRouter,
  simpleAuth: simpleAuthRouter,
});

export type AppRouter = typeof appRouter;
