/**
 * API Key 設定功能完整測試
 *
 * 測試範圍：
 * 1. settings.getAll    — 管理員取得所有設定（含遮罩邏輯驗證）
 * 2. settings.update    — 更新 API Key（合法值、空值、過長值、非管理員）
 * 3. settings.clear     — 清除 API Key（管理員 / 非管理員）
 * 4. settings.getStatus — 查詢設定狀態（已設定 / 未設定 / 短 Key 遮罩）
 * 5. wallets.query      — 錢包查詢時優先使用資料庫 Key
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import {
  getSystemSetting,
  upsertSystemSetting,
  getAllSystemSettings,
} from "./db";

// ── Mock 資料庫 ───────────────────────────────────────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
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
  getWalletProfilesByCaseId: vi.fn().mockResolvedValue([]),
  upsertWalletProfile: vi.fn().mockResolvedValue(undefined),
  deleteWalletProfilesByCaseId: vi.fn().mockResolvedValue(undefined),
  createWalletProfile: vi.fn().mockResolvedValue(undefined),
  getSystemSetting: vi.fn(),
  upsertSystemSetting: vi.fn().mockResolvedValue(undefined),
  getAllSystemSettings: vi.fn(),
}));

vi.mock("./suryaManager", () => ({
  startSuryaService: vi.fn().mockResolvedValue(undefined),
  stopSuryaService: vi.fn(),
}));

// ── 每個測試前清除所有 mock 呼叫記錄（避免跨 describe 污染） ─────────────────
beforeEach(() => {
  vi.clearAllMocks();
});

// ── 測試輔助函式 ──────────────────────────────────────────────────────────────
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

function createOfficerContext(): TrpcContext {
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
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. settings.getAll
// ═══════════════════════════════════════════════════════════════════════════════
describe("settings.getAll — 取得所有設定", () => {
  describe("管理員存取", () => {
    it("TC-SA-01：兩組 Key 均已設定時，回傳遮罩值且 isSet 為 true", async () => {
      vi.mocked(getAllSystemSettings).mockResolvedValue([
        {
          id: 1,
          settingKey: "ETHERSCAN_API_KEY",
          settingValue: "ABCD1234EFGH5678",
          description: "Etherscan API Key",
          updatedAt: new Date(),
          updatedBy: 99,
        },
        {
          id: 2,
          settingKey: "TRONSCAN_API_KEY",
          settingValue: "WXYZ9876MNOP5432",
          description: "Tronscan API Key",
          updatedAt: new Date(),
          updatedBy: 99,
        },
      ]);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.getAll();

      expect(result).toHaveLength(2);

      const eth = result.find(s => s.settingKey === "ETHERSCAN_API_KEY")!;
      const tron = result.find(s => s.settingKey === "TRONSCAN_API_KEY")!;

      expect(eth.isSet).toBe(true);
      expect(tron.isSet).toBe(true);
      // 遮罩格式：前 4 碼 + **** + 後 4 碼
      expect(eth.settingValue).toBe("ABCD****5678");
      expect(tron.settingValue).toBe("WXYZ****5432");
      // 不得回傳原始完整 Key
      expect(eth.settingValue).not.toBe("ABCD1234EFGH5678");
      expect(tron.settingValue).not.toBe("WXYZ9876MNOP5432");
    });

    it("TC-SA-02：兩組 Key 均未設定時，補充預設項目且 isSet 為 false", async () => {
      vi.mocked(getAllSystemSettings).mockResolvedValue([]);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.getAll();

      expect(result.length).toBeGreaterThanOrEqual(2);

      const eth = result.find(s => s.settingKey === "ETHERSCAN_API_KEY")!;
      const tron = result.find(s => s.settingKey === "TRONSCAN_API_KEY")!;

      expect(eth).toBeDefined();
      expect(tron).toBeDefined();
      expect(eth.isSet).toBe(false);
      expect(tron.isSet).toBe(false);
      expect(eth.settingValue).toBe("");
      expect(tron.settingValue).toBe("");
    });

    it("TC-SA-03：Key 長度 ≤ 8 時，遮罩應顯示 ****", async () => {
      vi.mocked(getAllSystemSettings).mockResolvedValue([
        {
          id: 1,
          settingKey: "ETHERSCAN_API_KEY",
          settingValue: "SHORT",
          description: null,
          updatedAt: new Date(),
          updatedBy: 99,
        },
      ]);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.getAll();

      const eth = result.find(s => s.settingKey === "ETHERSCAN_API_KEY")!;
      expect(eth.settingValue).toBe("****");
      expect(eth.isSet).toBe(true);
    });

    it("TC-SA-04：只有 ETHERSCAN_API_KEY 已設定，TRONSCAN_API_KEY 應自動補充為未設定", async () => {
      vi.mocked(getAllSystemSettings).mockResolvedValue([
        {
          id: 1,
          settingKey: "ETHERSCAN_API_KEY",
          settingValue: "ABCD1234EFGH5678",
          description: null,
          updatedAt: new Date(),
          updatedBy: 99,
        },
      ]);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.getAll();

      const eth = result.find(s => s.settingKey === "ETHERSCAN_API_KEY")!;
      const tron = result.find(s => s.settingKey === "TRONSCAN_API_KEY")!;

      expect(eth.isSet).toBe(true);
      expect(tron).toBeDefined();
      expect(tron.isSet).toBe(false);
    });
  });

  describe("一般員警存取（權限控制）", () => {
    it("TC-SA-05：一般員警呼叫 getAll 應拋出 FORBIDDEN 錯誤", async () => {
      const caller = appRouter.createCaller(createOfficerContext());
      await expect(caller.settings.getAll()).rejects.toThrow();
    });

    it("TC-SA-06：未登入使用者呼叫 getAll 應拋出錯誤", async () => {
      const publicCtx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(publicCtx);
      await expect(caller.settings.getAll()).rejects.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. settings.update
// ═══════════════════════════════════════════════════════════════════════════════
describe("settings.update — 更新 API Key", () => {
  describe("管理員更新", () => {
    it("TC-SU-01：管理員更新 ETHERSCAN_API_KEY 應成功", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.update({
        key: "ETHERSCAN_API_KEY",
        value: "NEW_ETHERSCAN_KEY_12345678",
      });

      expect(result.success).toBe(true);
      expect(upsertSystemSetting).toHaveBeenCalledWith(
        "ETHERSCAN_API_KEY",
        "NEW_ETHERSCAN_KEY_12345678",
        expect.any(String),
        99
      );
    });

    it("TC-SU-02：管理員更新 TRONSCAN_API_KEY 應成功", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.update({
        key: "TRONSCAN_API_KEY",
        value: "NEW_TRONSCAN_KEY_ABCDEFGH",
      });

      expect(result.success).toBe(true);
      expect(upsertSystemSetting).toHaveBeenCalledWith(
        "TRONSCAN_API_KEY",
        "NEW_TRONSCAN_KEY_ABCDEFGH",
        expect.any(String),
        99
      );
    });

    it("TC-SU-03：更新時 upsertSystemSetting 應帶入正確的 updatedBy（管理員 id = 99）", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      await caller.settings.update({
        key: "ETHERSCAN_API_KEY",
        value: "TEST_KEY_VALUE_XYZ",
      });

      const callArgs = vi.mocked(upsertSystemSetting).mock.calls[0];
      expect(callArgs[3]).toBe(99);
    });
  });

  describe("輸入驗證", () => {
    it("TC-SU-04：value 為空字串時應拋出 Zod 驗證錯誤", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.settings.update({ key: "ETHERSCAN_API_KEY", value: "" })
      ).rejects.toThrow();
    });

    it("TC-SU-05：key 為空字串時應拋出 Zod 驗證錯誤", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      await expect(
        caller.settings.update({ key: "", value: "some-api-key" })
      ).rejects.toThrow();
    });

    it("TC-SU-06：key 超過 128 字元時應拋出 Zod 驗證錯誤", async () => {
      const caller = appRouter.createCaller(createAdminContext());
      const longKey = "K".repeat(129);
      await expect(
        caller.settings.update({ key: longKey, value: "some-api-key" })
      ).rejects.toThrow();
    });
  });

  describe("一般員警存取（權限控制）", () => {
    it("TC-SU-07：一般員警呼叫 update 應拋出 FORBIDDEN 錯誤", async () => {
      const caller = appRouter.createCaller(createOfficerContext());
      await expect(
        caller.settings.update({ key: "ETHERSCAN_API_KEY", value: "hacked-key" })
      ).rejects.toThrow();
    });

    it("TC-SU-08：一般員警嘗試更新時，upsertSystemSetting 不應被呼叫", async () => {
      const caller = appRouter.createCaller(createOfficerContext());
      try {
        await caller.settings.update({ key: "ETHERSCAN_API_KEY", value: "hacked-key" });
      } catch {
        // 預期拋出錯誤
      }
      // clearAllMocks 在 beforeEach 已清除，此處確認本次呼叫未觸發
      expect(upsertSystemSetting).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. settings.clear
// ═══════════════════════════════════════════════════════════════════════════════
describe("settings.clear — 清除 API Key", () => {
  describe("管理員清除", () => {
    it("TC-SC-01：管理員清除 ETHERSCAN_API_KEY 應成功", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.clear({ key: "ETHERSCAN_API_KEY" });
      expect(result.success).toBe(true);
    });

    it("TC-SC-02：管理員清除 TRONSCAN_API_KEY 應成功", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      const result = await caller.settings.clear({ key: "TRONSCAN_API_KEY" });
      expect(result.success).toBe(true);
    });

    it("TC-SC-03：清除時應以空字串呼叫 upsertSystemSetting", async () => {
      vi.mocked(upsertSystemSetting).mockResolvedValue(undefined);

      const caller = appRouter.createCaller(createAdminContext());
      await caller.settings.clear({ key: "ETHERSCAN_API_KEY" });

      expect(upsertSystemSetting).toHaveBeenCalledWith(
        "ETHERSCAN_API_KEY",
        "",
        expect.anything(),
        99
      );
    });
  });

  describe("一般員警存取（權限控制）", () => {
    it("TC-SC-04：一般員警呼叫 clear 應拋出 FORBIDDEN 錯誤", async () => {
      const caller = appRouter.createCaller(createOfficerContext());
      await expect(
        caller.settings.clear({ key: "ETHERSCAN_API_KEY" })
      ).rejects.toThrow();
    });

    it("TC-SC-05：一般員警嘗試清除時，upsertSystemSetting 不應被呼叫", async () => {
      const caller = appRouter.createCaller(createOfficerContext());
      try {
        await caller.settings.clear({ key: "ETHERSCAN_API_KEY" });
      } catch {
        // 預期拋出錯誤
      }
      expect(upsertSystemSetting).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. settings.getStatus
// ═══════════════════════════════════════════════════════════════════════════════
describe("settings.getStatus — 查詢 API Key 設定狀態", () => {
  it("TC-SS-01：兩組 Key 均已設定時，isSet 均為 true 且回傳遮罩值", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ETHERSCAN_API_KEY") return "ABCD1234EFGH5678";
      if (key === "TRONSCAN_API_KEY") return "WXYZ9876MNOP5432";
      return null;
    });

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    expect(result.ETHERSCAN_API_KEY.isSet).toBe(true);
    expect(result.TRONSCAN_API_KEY.isSet).toBe(true);
    expect(result.ETHERSCAN_API_KEY.maskedValue).toBe("ABCD****5678");
    expect(result.TRONSCAN_API_KEY.maskedValue).toBe("WXYZ****5432");
  });

  it("TC-SS-02：兩組 Key 均未設定時，isSet 均為 false", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue(null);

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    expect(result.ETHERSCAN_API_KEY.isSet).toBe(false);
    expect(result.TRONSCAN_API_KEY.isSet).toBe(false);
    expect(result.ETHERSCAN_API_KEY.maskedValue).toBe("");
    expect(result.TRONSCAN_API_KEY.maskedValue).toBe("");
  });

  it("TC-SS-03：只有 ETHERSCAN_API_KEY 已設定時，TRON 應為 false", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ETHERSCAN_API_KEY") return "ABCD1234EFGH5678";
      return null;
    });

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    expect(result.ETHERSCAN_API_KEY.isSet).toBe(true);
    expect(result.TRONSCAN_API_KEY.isSet).toBe(false);
  });

  it("TC-SS-04：只有 TRONSCAN_API_KEY 已設定時，ETH 應為 false", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "TRONSCAN_API_KEY") return "WXYZ9876MNOP5432";
      return null;
    });

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    expect(result.ETHERSCAN_API_KEY.isSet).toBe(false);
    expect(result.TRONSCAN_API_KEY.isSet).toBe(true);
  });

  it("TC-SS-05：Key 長度 ≤ 8 時，maskedValue 應為 ****", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ETHERSCAN_API_KEY") return "ABCD";
      return null;
    });

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    expect(result.ETHERSCAN_API_KEY.isSet).toBe(true);
    expect(result.ETHERSCAN_API_KEY.maskedValue).toBe("****");
  });

  it("TC-SS-06：清除後（空字串）isSet 應為 false", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ETHERSCAN_API_KEY") return "";
      return null;
    });

    const caller = appRouter.createCaller(createOfficerContext());
    const result = await caller.settings.getStatus();

    // 空字串視為未設定
    expect(result.ETHERSCAN_API_KEY.isSet).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. wallets.query — 錢包查詢時優先使用資料庫 Key
// ═══════════════════════════════════════════════════════════════════════════════
describe("wallets.query — API Key 優先順序", () => {
  it("TC-WQ-01：資料庫有 Key 時，getSystemSetting 應被呼叫（優先使用資料庫 Key）", async () => {
    vi.mocked(getSystemSetting).mockImplementation(async (key: string) => {
      if (key === "ETHERSCAN_API_KEY") return "DB_ETH_KEY_12345678";
      if (key === "TRONSCAN_API_KEY") return "DB_TRON_KEY_ABCDEFGH";
      return null;
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "1",
        result: { ETH: "1.5", balance: "1500000000000000000" },
      }),
    });

    const caller = appRouter.createCaller(createOfficerContext());
    try {
      await caller.wallets.query({
        caseId: 1,
        addresses: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"],
      });
    } catch {
      // 查詢可能因 mock 格式不完整而失敗，重點是確認 getSystemSetting 被呼叫
    }

    expect(getSystemSetting).toHaveBeenCalledWith("ETHERSCAN_API_KEY");
    expect(getSystemSetting).toHaveBeenCalledWith("TRONSCAN_API_KEY");
  });

  it("TC-WQ-02：資料庫無 Key 時，getSystemSetting 仍應被呼叫（fallback 至環境變數）", async () => {
    vi.mocked(getSystemSetting).mockResolvedValue(null);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const caller = appRouter.createCaller(createOfficerContext());
    try {
      await caller.wallets.query({
        caseId: 1,
        addresses: ["0x742d35Cc6634C0532925a3b844Bc454e4438f44e"],
      });
    } catch {
      // 預期可能因 mock 不完整而失敗
    }

    expect(getSystemSetting).toHaveBeenCalledWith("ETHERSCAN_API_KEY");
    expect(getSystemSetting).toHaveBeenCalledWith("TRONSCAN_API_KEY");
  });
});
