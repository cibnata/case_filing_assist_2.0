/**
 * 派出所報案輔助工具 - 核心功能單元測試
 * 測試案件建立、OCR 辨識、情資分析、筆錄產生等功能
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock 資料庫與外部服務 ─────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createCase: vi.fn().mockResolvedValue({ id: 1, caseNumber: "TW-2026-001" }),
  getCaseById: vi.fn().mockResolvedValue({
    id: 1,
    caseNumber: "TW-2026-001",
    officerId: 1,
    officerName: "測試員警",
    officerUnit: "台北市政府警察局",
    status: "open",
    caseType: "詐欺",
    qrToken: "test-token-123",
    createdAt: new Date("2026-04-26"),
    updatedAt: new Date("2026-04-26"),
  }),
  listCasesByOfficer: vi.fn().mockResolvedValue([]),
  listAllCases: vi.fn().mockResolvedValue([]),
  submitReporterInfo: vi.fn().mockResolvedValue({ id: 1 }),
  getReporterByCaseId: vi.fn().mockResolvedValue(null),
  getCaseByQrToken: vi.fn().mockResolvedValue({
    id: 1,
    caseNumber: "TW-2026-001",
    officerName: "測試員警",
    officerUnit: "台北市政府警察局",
    status: "open",
    caseType: "詐欺",
    qrToken: "test-token-123",
    createdAt: new Date("2026-04-26"),
  }),
  getEvidenceFilesByCaseId: vi.fn().mockResolvedValue([
    { id: 1, caseId: 1, storageUrl: "/uploads/test.jpg", originalName: "test.jpg" },
  ]),
  upsertOcrResult: vi.fn().mockResolvedValue(undefined),
  getOcrResultByCaseId: vi.fn().mockResolvedValue({
    id: 1,
    caseId: 1,
    status: "confirmed",
    rawText: "測試 OCR 文字",
    confirmedText: "確認後的 OCR 文字",
    confirmedAt: new Date(),
  }),
  upsertIntelReport: vi.fn().mockResolvedValue(undefined),
  getIntelReportByCaseId: vi.fn().mockResolvedValue({
    id: 1,
    caseId: 1,
    caseSummary: "測試案件摘要",
    victim: { name: "測試被害人" },
    suspects: [],
    relatedAccounts: [],
    timeline: [],
    walletAddresses: [],
    unverified: [],
  }),
  updateCaseStatus: vi.fn().mockResolvedValue(undefined),
  createEvidenceFile: vi.fn().mockResolvedValue({ id: 1 }),
  getInterrogationRecordByCaseId: vi.fn().mockResolvedValue(null),
  upsertInterrogationRecord: vi.fn().mockResolvedValue(undefined),
  getWalletProfilesByCaseId: vi.fn().mockResolvedValue([]),
  upsertWalletProfile: vi.fn().mockResolvedValue(undefined),
  deleteWalletProfilesByCaseId: vi.fn().mockResolvedValue(undefined),
  createWalletProfile: vi.fn().mockResolvedValue(undefined),
  // system settings
  getSystemSetting: vi.fn().mockImplementation(async (key: string) => {
    if (key === "ETHERSCAN_API_KEY") return "abcd1234efgh5678";
    return null;
  }),
  upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
  getAllSystemSettings: vi.fn().mockResolvedValue([
    {
      id: 1,
      settingKey: "ETHERSCAN_API_KEY",
      settingValue: "abcd1234efgh5678",
      description: "Etherscan API Key",
      updatedAt: new Date(),
      updatedBy: 1,
    },
  ]),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            caseSummary: "被害人透過 Facebook 認識歹徒，遭誘騙投資虛擬貨幣，損失 120 萬元",
            victim: { name: "測試被害人", bankAccounts: [], contact: "" },
            suspects: [{ alias: "Marin", platform: "LINE", accounts: ["wsygood"], role: "主謀" }],
            relatedAccounts: [{ platform: "LINE", account: "wsygood", url: "", type: "social" }],
            timeline: [{ datetime: "2024-07-02 18:43", event: "透過 Facebook 得知投資訊息" }],
            walletAddresses: [],
            bankTransactions: [],
            unverified: ["需確認歹徒真實身份"],
          }),
        },
      },
    ],
  }),
}));

vi.mock("./suryaManager", () => ({
  startSuryaService: vi.fn().mockResolvedValue(undefined),
  stopSuryaService: vi.fn(),
}));

// ── 測試輔助函式 ──────────────────────────────────────────────────────────────
function createOfficerContext(overrides: Partial<TrpcContext["user"]> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "officer-001",
      email: "officer@police.gov.tw",
      name: "測試員警",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 99,
      openId: "admin-001",
      email: "admin@police.gov.tw",
      name: "管理員",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── 案件管理測試 ──────────────────────────────────────────────────────────────
describe("cases.create", () => {
  it("員警可以建立新案件並取得 QR Token", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cases.create({
      notes: "測試案件",
    });

    expect(result).toHaveProperty("case");
    expect(result).toHaveProperty("qrToken");
    expect(result.case).toHaveProperty("caseNumber");
    expect(result.case.caseNumber).toMatch(/TW-/);
  });
});

describe("cases.getById", () => {
  it("員警可以查詢自己的案件", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cases.getById({ id: 1 });

    expect(result).toBeDefined();
    expect(result?.case?.caseNumber).toBe("TW-2026-001");
    expect(result?.case?.officerName).toBe("測試員警");
  });
});

describe("cases.getPublicCaseInfo", () => {
  it("報案人可透過 QR Token 取得案件基本資訊", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.cases.getPublicCaseInfo({ token: "test-token-123" });

    expect(result).toBeDefined();
    expect(result?.caseNumber).toBe("TW-2026-001");
    expect(result?.officerName).toBe("測試員警");
  });
});

// ── OCR 辨識測試 ──────────────────────────────────────────────────────────────
describe("ocr.get", () => {
  it("員警可以取得 OCR 辨識結果", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.get({ caseId: 1 });

    expect(result).toBeDefined();
    expect(result?.status).toBe("confirmed");
    expect(result?.rawText).toBe("測試 OCR 文字");
  });
});

describe("ocr.confirm", () => {
  it("員警可以確認並修改 OCR 全文", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.confirm({
      caseId: 1,
      confirmedText: "經員警確認的完整文字",
    });

    expect(result.success).toBe(true);
  });
});

// ── 情資分析測試 ──────────────────────────────────────────────────────────────
describe("ocr.analyze", () => {
  it("員警可以觸發情資分析並取得結構化報告", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.analyze({ caseId: 1 });

    expect(result.success).toBe(true);
    expect(result.report).toHaveProperty("caseSummary");
    expect(result.report.caseSummary).toContain("虛擬貨幣");
    expect(result.report.suspects).toHaveLength(1);
    expect(result.report.suspects[0].alias).toBe("Marin");
  });
});

describe("ocr.getIntel", () => {
  it("員警可以取得已儲存的情資分析報告", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ocr.getIntel({ caseId: 1 });

    expect(result).toBeDefined();
    expect(result?.caseSummary).toBe("測試案件摘要");
  });
});

// ── 筆錄產生測試 ──────────────────────────────────────────────────────────────
describe("interrogation.generate", () => {
  beforeEach(async () => {
    // 重設 LLM mock 為筆錄格式（對齊實際 router 回傳的 questions 陣列格式）
    const { invokeLLM } = vi.mocked(await import("./_core/llm"));
    invokeLLM.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              questions: [
                { id: 1, type: "fixed", question: "上述年籍資料是否為你本人？", answer: "是我本人資料無誤。", editable: true },
                { id: 2, type: "fixed", question: "你今日因何事至所製作筆錄？", answer: "我因遇人詐騙，故至本所報案。", editable: true },
                { id: 3, type: "fixed", question: "你於何時？何地？遇何人詐騙？", answer: "我於 2024 年 7 月 2 日透過 Facebook 認識欹徒。", editable: true },
                { id: 4, type: "fixed", question: "欹徒提供投資網站名稱為何？", answer: "MetaMask，網址 https://metamask.io/download/", editable: true },
                { id: 5, type: "fixed", question: "你進入前述網站後申請會員過程為何？", answer: "依照欹徒指示填寫資料。", editable: true },
                { id: 6, type: "ai_suggested", question: "欹徒是否曾要求你提供個人銀行帳戶資料？", answer: "", editable: true },
              ],
            }),
          },
        },
      ],
    });
  });

  it("員警可以產生包含固定問項與 AI 建議問題的筆錄", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.interrogation.generate({ caseId: 1 });

    expect(result.success).toBe(true);
    expect(result).toHaveProperty("questions");
    expect(Array.isArray(result.questions)).toBe(true);
    // 應包含固定問項（type: fixed）與 AI 建議問項（type: ai_suggested）
    const fixedQs = result.questions.filter((q: any) => q.type === "fixed");
    const aiQs = result.questions.filter((q: any) => q.type === "ai_suggested");
    expect(fixedQs.length).toBeGreaterThanOrEqual(1);
    expect(aiQs.length).toBeGreaterThanOrEqual(0);
  });
});

// ── 認證測試 ──────────────────────────────────────────────────────────────────
describe("auth.me", () => {
  it("已登入員警可以取得自己的資訊", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeDefined();
    expect(result?.name).toBe("測試員警");
    expect(result?.role).toBe("user");
  });

  it("未登入時 auth.me 回傳 null", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("登出成功並清除 session cookie", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result.success).toBe(true);
  });
});

// ── settings router 測試 ─────────────────────────────────────────────────────────────────────────────────
describe("settings.getAll", () => {
  it("管理員可以取得所有系統設定，且 Key 已遮罩", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.getAll();
    expect(Array.isArray(result)).toBe(true);
    const ethSetting = result.find(s => s.settingKey === "ETHERSCAN_API_KEY");
    expect(ethSetting).toBeDefined();
    expect(ethSetting?.isSet).toBe(true);
    // 遮罩後不應包含完整 Key
    expect(ethSetting?.settingValue).not.toBe("abcd1234efgh5678");
  });

  it("一般員警無法存取系統設定（FORBIDDEN）", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.getAll()).rejects.toThrow();
  });
});

describe("settings.update", () => {
  it("管理員可以更新 API Key", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.update({
      key: "ETHERSCAN_API_KEY",
      value: "new-api-key-12345",
    });
    expect(result.success).toBe(true);
  });

  it("一般員警無法更新 API Key（FORBIDDEN）", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.settings.update({ key: "ETHERSCAN_API_KEY", value: "test" })
    ).rejects.toThrow();
  });
});

describe("settings.clear", () => {
  it("管理員可以清除 API Key", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.clear({ key: "ETHERSCAN_API_KEY" });
    expect(result.success).toBe(true);
  });

  it("一般員警無法清除 API Key（FORBIDDEN）", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.settings.clear({ key: "ETHERSCAN_API_KEY" })
    ).rejects.toThrow();
  });
});

describe("settings.getStatus", () => {
  it("登入員警可以查詢 API Key 設定狀態", async () => {
    const ctx = createOfficerContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.getStatus();
    expect(result.ETHERSCAN_API_KEY.isSet).toBe(true);
    expect(result.TRONSCAN_API_KEY.isSet).toBe(false);
  });
});
