import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  longtext,
  timestamp,
  varchar,
  json,
  bigint,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  unit: varchar("unit", { length: 128 }),
  badgeNumber: varchar("badgeNumber", { length: 32 }),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── 案件主表 ───────────────────────────────────────────────────────────────
export const cases = mysqlTable("cases", {
  id: int("id").autoincrement().primaryKey(),
  caseNumber: varchar("caseNumber", { length: 64 }).notNull().unique(),
  qrToken: varchar("qrToken", { length: 128 }).notNull().unique(),
  officerId: int("officerId").notNull(),
  officerName: varchar("officerName", { length: 64 }).notNull(),
  officerUnit: varchar("officerUnit", { length: 128 }).notNull(),
  status: mysqlEnum("status", [
    "pending",
    "submitted",
    "ocr_pending",
    "ocr_done",
    "analyzing",
    "analyzed",
    "closed",
  ]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

// ─── 報案人資料表 ────────────────────────────────────────────────────────────
export const reporters = mysqlTable("reporters", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  idNumber: varchar("idNumber", { length: 10 }).notNull(),
  birthDate: varchar("birthDate", { length: 16 }).notNull(),
  address: text("address").notNull(),
  registeredAddress: text("registeredAddress"),
  caseType: varchar("caseType", { length: 64 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  gender: varchar("gender", { length: 8 }),
  birthPlace: varchar("birthPlace", { length: 64 }),
  occupation: varchar("occupation", { length: 64 }),
  education: varchar("education", { length: 32 }),
  economicStatus: varchar("economicStatus", { length: 16 }), // 貧寒/勉持/小康/中產/富裕
  aliasId: varchar("aliasId", { length: 32 }),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});

export type Reporter = typeof reporters.$inferSelect;
export type InsertReporter = typeof reporters.$inferInsert;

// ─── 證物圖片表 ──────────────────────────────────────────────────────────────
export const evidenceFiles = mysqlTable("evidence_files", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  storageUrl: text("storageUrl").notNull(),
  originalName: varchar("originalName", { length: 256 }),
  mimeType: varchar("mimeType", { length: 64 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  // 逐張圖片 OCR 狀態
  ocrStatus: mysqlEnum("ocrStatus", ["pending", "processing", "done", "failed"]).default("pending").notNull(),
  ocrText: longtext("ocrText"),
  ocrProcessedAt: timestamp("ocrProcessedAt"),
});

export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type InsertEvidenceFile = typeof evidenceFiles.$inferInsert;

// ─── OCR 辨識結果表 ──────────────────────────────────────────────────────────
export const ocrResults = mysqlTable("ocr_results", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().unique(),
  rawText: text("rawText"),
  confirmedText: text("confirmedText"),
  status: mysqlEnum("status", ["pending", "processing", "done", "confirmed"]).default("pending").notNull(),
  processedAt: timestamp("processedAt"),
  confirmedAt: timestamp("confirmedAt"),
  confirmedBy: int("confirmedBy"),
});

export type OcrResult = typeof ocrResults.$inferSelect;
export type InsertOcrResult = typeof ocrResults.$inferInsert;

// ─── 情資分析報告表 ──────────────────────────────────────────────────────────
export const intelReports = mysqlTable("intel_reports", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().unique(),
  caseSummary: text("caseSummary"),
  victim: json("victim"),
  suspects: json("suspects"),
  relatedAccounts: json("relatedAccounts"),
  timeline: json("timeline"),
  walletAddresses: json("walletAddresses"),
  unverified: json("unverified"),
  rawAnalysis: text("rawAnalysis"),
  analyzedAt: timestamp("analyzedAt"),
  analyzedBy: int("analyzedBy"),
});

export type IntelReport = typeof intelReports.$inferSelect;
export type InsertIntelReport = typeof intelReports.$inferInsert;

// ─── 錢包分析表 ──────────────────────────────────────────────────────────────
export const walletProfiles = mysqlTable("wallet_profiles", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull(),
  address: varchar("address", { length: 128 }).notNull(),
  chain: varchar("chain", { length: 32 }).notNull(),
  createTime: varchar("createTime", { length: 64 }),
  lastTransactionDate: varchar("lastTransactionDate", { length: 64 }),
  transactionTimes: int("transactionTimes"),
  transInTimes: int("transInTimes"),
  transInAmount: varchar("transInAmount", { length: 64 }),
  transOutTimes: int("transOutTimes"),
  transOutAmount: varchar("transOutAmount", { length: 64 }),
  trc20Ledger: json("trc20Ledger"),
  rawData: json("rawData"),
  queriedAt: timestamp("queriedAt").defaultNow().notNull(),
});

export type WalletProfile = typeof walletProfiles.$inferSelect;
export type InsertWalletProfile = typeof walletProfiles.$inferInsert;

// ─── 調查筆錄表 ──────────────────────────────────────────────────────────────
/**
 * 筆錄問答結構：
 * {
 *   header: { startTime, endTime, location, caseReason },
 *   questions: Array<{
 *     id: number,
 *     type: "fixed" | "ai_suggested",
 *     question: string,
 *     answer: string,
 *     editable: boolean
 *   }>
 * }
 */
export const interrogationRecords = mysqlTable("interrogation_records", {
  id: int("id").autoincrement().primaryKey(),
  caseId: int("caseId").notNull().unique(),
  status: mysqlEnum("status", ["pending", "generating", "draft", "finalized"]).default("pending").notNull(),
  // 筆錄表頭
  startTime: varchar("startTime", { length: 32 }),
  endTime: varchar("endTime", { length: 32 }),
  location: varchar("location", { length: 256 }),
  // 問答內容（JSON）
  questions: json("questions"), // Array<{ id, type, question, answer, editable }>
  rawGenerated: text("rawGenerated"), // LLM 原始輸出
  generatedAt: timestamp("generatedAt"),
  finalizedAt: timestamp("finalizedAt"),
  finalizedBy: int("finalizedBy"),
});

export type InterrogationRecord = typeof interrogationRecords.$inferSelect;
export type InsertInterrogationRecord = typeof interrogationRecords.$inferInsert;

// ─── 系統設定表 ──────────────────────────────────────────────────────────────
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 128 }).notNull().unique(),
  settingValue: text("settingValue"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedBy: int("updatedBy"),
});
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;
