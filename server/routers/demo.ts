/**
 * Demo Router — 提供假資料供展示用途
 * 所有 procedure 均為 public（無需登入）
 */
import { publicProcedure, router } from "../_core/trpc";

// ─── 假資料常數 ──────────────────────────────────────────────────────────────

const MOCK_CASES = [
  {
    id: 1,
    caseNumber: "2024-NTP-001234",
    officerName: "陳志明",
    officerUnit: "新北市政府警察局板橋分局",
    status: "analyzed",
    notes: "被害人遭投資詐騙，損失約 120 萬元，已完成情資分析",
    qrToken: "demo-token-001",
    createdAt: new Date("2024-11-15T09:30:00"),
    updatedAt: new Date("2024-11-16T14:20:00"),
  },
  {
    id: 2,
    caseNumber: "2024-NTP-001235",
    officerName: "林美玲",
    officerUnit: "新北市政府警察局板橋分局",
    status: "submitted",
    notes: "假冒公務員詐騙，被害人已提交資料，待 OCR 辨識",
    qrToken: "demo-token-002",
    createdAt: new Date("2024-11-16T10:15:00"),
    updatedAt: new Date("2024-11-16T11:00:00"),
  },
  {
    id: 3,
    caseNumber: "2024-NTP-001236",
    officerName: "陳志明",
    officerUnit: "新北市政府警察局板橋分局",
    status: "pending",
    notes: "網路購物詐騙，等待被害人填寫資料",
    qrToken: "demo-token-003",
    createdAt: new Date("2024-11-17T08:45:00"),
    updatedAt: new Date("2024-11-17T08:45:00"),
  },
  {
    id: 4,
    caseNumber: "2024-NTP-001237",
    officerName: "王建國",
    officerUnit: "新北市政府警察局板橋分局",
    status: "closed",
    notes: "愛情詐騙，已結案移送",
    qrToken: "demo-token-004",
    createdAt: new Date("2024-11-10T14:00:00"),
    updatedAt: new Date("2024-11-14T16:30:00"),
  },
  {
    id: 5,
    caseNumber: "2024-NTP-001238",
    officerName: "林美玲",
    officerUnit: "新北市政府警察局板橋分局",
    status: "ocr_done",
    notes: "加密貨幣詐騙，OCR 辨識完成，待確認",
    qrToken: "demo-token-005",
    createdAt: new Date("2024-11-17T11:20:00"),
    updatedAt: new Date("2024-11-17T13:45:00"),
  },
];

const MOCK_REPORTER = {
  id: 1,
  caseId: 1,
  name: "張小明",
  gender: "男",
  birthDate: "1985-03-22",
  birthPlace: "台北市",
  idNumber: "A123456789",
  occupation: "工程師",
  registeredAddress: "新北市板橋區中山路一段100號",
  address: "新北市板橋區文化路二段88號5樓",
  education: "大學",
  phone: "0912-345-678",
  economicStatus: "小康",
  caseType: "投資詐騙",
  submittedAt: new Date("2024-11-15T10:30:00"),
};

const MOCK_EVIDENCE_FILES = [
  {
    id: 1,
    caseId: 1,
    storageKey: "demo/evidence_001.jpg",
    storageUrl: "https://picsum.photos/seed/scam1/400/600",
    originalName: "LINE對話截圖_001.jpg",
    mimeType: "image/jpeg",
    fileSize: 245760,
    uploadedAt: new Date("2024-11-15T10:35:00"),
  },
  {
    id: 2,
    caseId: 1,
    storageKey: "demo/evidence_002.jpg",
    storageUrl: "https://picsum.photos/seed/scam2/400/600",
    originalName: "投資平台截圖_001.jpg",
    mimeType: "image/jpeg",
    fileSize: 312480,
    uploadedAt: new Date("2024-11-15T10:36:00"),
  },
  {
    id: 3,
    caseId: 1,
    storageKey: "demo/evidence_003.jpg",
    storageUrl: "https://picsum.photos/seed/scam3/400/600",
    originalName: "轉帳紀錄截圖.jpg",
    mimeType: "image/jpeg",
    fileSize: 198240,
    uploadedAt: new Date("2024-11-15T10:37:00"),
  },
];

const MOCK_OCR_RESULT = {
  id: 1,
  caseId: 1,
  status: "confirmed",
  rawText: `LINE 對話紀錄
投資顧問「王大明」：您好，我是專業投資顧問，有一個穩定獲利的投資機會想介紹給您。
張小明：什麼投資？
王大明：這是一個海外加密貨幣套利平台，每月穩定獲利 15-20%，已有數千位投資人獲利。
王大明：平台網址：https://invest-profit888.com
王大明：您只需要先入金 10 萬元，就可以開始操作。
張小明：好的，我先匯款試試看。
---
轉帳紀錄
日期：2024/11/01
金額：100,000 元
收款帳號：012-345678-9
收款人：王大明
備註：投資款項
---
後續追加匯款：
2024/11/05 追加 200,000 元
2024/11/10 追加 300,000 元
2024/11/12 追加 700,000 元
合計損失：1,300,000 元`,
  confirmedText: `LINE 對話紀錄
投資顧問「王大明」：您好，我是專業投資顧問，有一個穩定獲利的投資機會想介紹給您。
張小明：什麼投資？
王大明：這是一個海外加密貨幣套利平台，每月穩定獲利 15-20%，已有數千位投資人獲利。
王大明：平台網址：https://invest-profit888.com
王大明：您只需要先入金 10 萬元，就可以開始操作。
張小明：好的，我先匯款試試看。
---
轉帳紀錄
日期：2024/11/01
金額：100,000 元
收款帳號：012-345678-9
收款人：王大明
備註：投資款項
---
後續追加匯款：
2024/11/05 追加 200,000 元
2024/11/10 追加 300,000 元
2024/11/12 追加 700,000 元
合計損失：1,300,000 元`,
  processedAt: new Date("2024-11-15T11:00:00"),
  confirmedAt: new Date("2024-11-15T11:30:00"),
  confirmedBy: 1,
};

const MOCK_INTEL_REPORT = {
  id: 1,
  caseId: 1,
  caseSummary: "被害人張小明於 2024 年 11 月遭投資詐騙，詐騙集團以高報酬加密貨幣套利平台為誘餌，透過 LINE 聯繫被害人，誘使其分四次匯款共計 130 萬元至指定帳戶。詐騙集團使用假名「王大明」，操作虛假投資平台 invest-profit888.com，並提供 TRON 錢包地址收取加密貨幣。",
  victim: {
    name: "張小明",
    idNumber: "A123456789",
    phone: "0912-345-678",
    address: "新北市板橋區文化路二段88號5樓",
    totalLoss: "1,300,000 元",
  },
  suspects: [
    {
      alias: "王大明",
      platform: "LINE",
      accounts: ["@wangdaming_invest", "LINE ID: invest_profit"],
      role: "主要詐騙者",
    },
  ],
  relatedAccounts: [
    { platform: "銀行帳號", account: "012-345678-9", type: "收款帳戶" },
    { platform: "投資平台", url: "https://invest-profit888.com", type: "詐騙網站" },
    { platform: "LINE", account: "@wangdaming_invest", type: "詐騙帳號" },
  ],
  timeline: [
    { datetime: "2024-10-28", event: "詐騙者透過 LINE 主動聯繫被害人，自稱投資顧問" },
    { datetime: "2024-11-01", event: "被害人首次匯款 10 萬元至指定帳戶" },
    { datetime: "2024-11-05", event: "被害人追加匯款 20 萬元" },
    { datetime: "2024-11-10", event: "被害人追加匯款 30 萬元" },
    { datetime: "2024-11-12", event: "被害人追加匯款 70 萬元，發現無法提領後報警" },
    { datetime: "2024-11-15", event: "被害人至派出所報案" },
  ],
  walletAddresses: [
    { address: "TXyz1234567890abcdef1234567890abcdef12", chain: "TRON" },
    { address: "0xAbCd1234567890abcdef1234567890abcdef12", chain: "ETH" },
  ],
  unverified: [
    "詐騙者真實身分尚未確認",
    "是否有其他共犯待查",
    "資金流向追蹤中",
  ],
  analyzedAt: new Date("2024-11-15T12:00:00"),
  analyzedBy: 1,
};

const MOCK_WALLETS = [
  {
    id: 1,
    caseId: 1,
    address: "TXyz1234567890abcdef1234567890abcdef12",
    chain: "TRON",
    createTime: "2024-09-01T00:00:00Z",
    lastTransactionDate: "2024-11-12T18:30:00Z",
    transactionTimes: 47,
    transInTimes: 32,
    transInAmount: "4,520,000 USDT",
    transOutTimes: 15,
    transOutAmount: "4,480,000 USDT",
    trc20Ledger: [
      { tokenSymbol: "USDT", direction: "IN", amount: "100000", date: "2024-11-01T10:00:00Z", from: "TAbcd...1234", to: "TXyz1...ef12" },
      { tokenSymbol: "USDT", direction: "IN", amount: "200000", date: "2024-11-05T14:30:00Z", from: "TAbcd...1234", to: "TXyz1...ef12" },
      { tokenSymbol: "USDT", direction: "IN", amount: "300000", date: "2024-11-10T09:15:00Z", from: "TAbcd...1234", to: "TXyz1...ef12" },
      { tokenSymbol: "USDT", direction: "IN", amount: "700000", date: "2024-11-12T18:00:00Z", from: "TAbcd...1234", to: "TXyz1...ef12" },
      { tokenSymbol: "USDT", direction: "OUT", amount: "1290000", date: "2024-11-12T18:30:00Z", from: "TXyz1...ef12", to: "TZzzz...9999" },
    ],
    queriedAt: new Date("2024-11-15T12:30:00"),
  },
  {
    id: 2,
    caseId: 1,
    address: "0xAbCd1234567890abcdef1234567890abcdef12",
    chain: "ETH",
    createTime: "2024-08-15T00:00:00Z",
    lastTransactionDate: "2024-11-11T22:00:00Z",
    transactionTimes: 23,
    transInTimes: 18,
    transInAmount: "8.5 ETH",
    transOutTimes: 5,
    transOutAmount: "8.3 ETH",
    trc20Ledger: [],
    queriedAt: new Date("2024-11-15T12:35:00"),
  },
];

const MOCK_INTERROGATION = {
  record: {
    id: 1,
    caseId: 1,
    status: "draft",
    startTime: "2024-11-15T09:00",
    endTime: "2024-11-15T10:30",
    location: "新北市政府警察局板橋分局偵查隊偵訊室",
    questions: [
      {
        id: 1,
        type: "fixed",
        question: "問：上述年籍資料是否為你本人？",
        answer: "答：是的，上述年籍資料均為本人資料，並無誤。",
        editable: true,
      },
      {
        id: 2,
        type: "fixed",
        question: "問：你現在住所是否與戶籍地址相同？如有司法傳喚，能否收到通知？",
        answer: "答：本人現住地址為新北市板橋區文化路二段88號5樓，與戶籍地址不同。如有司法傳喚，請寄至現住地址，本人可以收到通知。",
        editable: true,
      },
      {
        id: 3,
        type: "fixed",
        question: "問：你今日因何事至所製作筆錄？",
        answer: "答：本人於民國 113 年 11 月間，遭不明人士以投資加密貨幣為由實施詐騙，損失共計新台幣 130 萬元，特來報案並製作筆錄。",
        editable: true,
      },
      {
        id: 4,
        type: "fixed",
        question: "問：你於何時？何地？遭何人詐騙？請詳述詐騙之過程。",
        answer: "答：本人於民國 113 年 10 月 28 日，透過 LINE 通訊軟體，遭一名自稱「王大明」之投資顧問聯繫。對方聲稱有一個海外加密貨幣套利平台，每月可穩定獲利 15-20%，並提供平台網址 invest-profit888.com 供本人參考。本人信以為真，於 11 月 1 日首次匯款新台幣 10 萬元至對方指定之銀行帳號 012-345678-9，後因對方以獲利需追加本金為由，陸續於 11 月 5 日追加 20 萬元、11 月 10 日追加 30 萬元、11 月 12 日追加 70 萬元，合計損失新台幣 130 萬元。嗣後本人欲提領獲利，發現無法提款，始知遭騙。",
        editable: true,
      },
      {
        id: 5,
        type: "fixed",
        question: "問：歹徒提供投資網站名稱為何？網址為？有無提供 APP 下載連結？",
        answer: "答：歹徒提供之投資平台名稱為「Profit888 投資平台」，網址為 https://invest-profit888.com。對方有提供 APP 下載連結，但本人未下載，均透過網頁版操作。",
        editable: true,
      },
      {
        id: 6,
        type: "ai_suggested",
        question: "問（AI建議）：你與「王大明」之間的 LINE 對話是否仍保存於手機中？是否願意提供手機供鑑識？",
        answer: "答：本人手機中仍保有與對方之 LINE 對話紀錄，本人願意配合提供手機供警方鑑識。",
        editable: true,
      },
      {
        id: 7,
        type: "ai_suggested",
        question: "問（AI建議）：你所匯款之銀行帳號 012-345678-9，是否有保存匯款收據或網路銀行轉帳紀錄？",
        answer: "答：本人有保存網路銀行之轉帳紀錄截圖，已一併提供給員警作為證據。",
        editable: true,
      },
      {
        id: 8,
        type: "ai_suggested",
        question: "問（AI建議）：你是否曾將加密貨幣直接匯至 TRON 錢包地址 TXyz1234567890abcdef1234567890abcdef12？",
        answer: "答：本人不清楚加密貨幣錢包相關操作，所有款項均以新台幣透過銀行匯款，未直接操作加密貨幣。",
        editable: true,
      },
    ],
    generatedAt: new Date("2024-11-15T13:00:00"),
  },
};

// ─── Demo Router ─────────────────────────────────────────────────────────────

export const demoRouter = router({
  /** 案件列表 */
  getCases: publicProcedure.query(() => MOCK_CASES),

  /** 案件詳情（固定回傳 case id=1 的完整資料） */
  getCaseDetail: publicProcedure.query(() => ({
    case: MOCK_CASES[0],
    reporter: MOCK_REPORTER,
    files: MOCK_EVIDENCE_FILES,
    ocr: MOCK_OCR_RESULT,
    intel: MOCK_INTEL_REPORT,
    wallets: MOCK_WALLETS,
  })),

  /** 取得假 QR Code 資訊 */
  getQrInfo: publicProcedure.query(() => ({
    reportUrl: `${process.env.VITE_APP_URL || "http://localhost:3000"}/report/demo-token-001`,
    qrCodeDataUrl: null,
  })),

  /** OCR 結果 */
  getOcr: publicProcedure.query(() => MOCK_OCR_RESULT),

  /** 情資分析 */
  getIntel: publicProcedure.query(() => MOCK_INTEL_REPORT),

  /** 錢包列表 */
  getWallets: publicProcedure.query(() => MOCK_WALLETS),

  /** 筆錄 */
  getInterrogation: publicProcedure.query(() => MOCK_INTERROGATION),

  /** 統計數字 */
  getStats: publicProcedure.query(() => ({
    total: MOCK_CASES.length,
    pending: MOCK_CASES.filter(c => c.status === "pending").length,
    submitted: MOCK_CASES.filter(c => c.status === "submitted").length,
    analyzed: MOCK_CASES.filter(c => c.status === "analyzed").length,
    closed: MOCK_CASES.filter(c => c.status === "closed").length,
  })),
});
