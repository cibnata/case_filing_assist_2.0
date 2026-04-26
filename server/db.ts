import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  cases,
  reporters,
  evidenceFiles,
  ocrResults,
  intelReports,
  walletProfiles,
  interrogationRecords,
  systemSettings,
  type InsertCase,
  type InsertReporter,
  type InsertEvidenceFile,
  type InsertOcrResult,
  type InsertIntelReport,
  type InsertWalletProfile,
  type InsertInterrogationRecord,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserProfile(userId: number, data: { unit?: string; badgeNumber?: string; name?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}

// ─── Cases ───────────────────────────────────────────────────────────────────
export async function createCase(data: InsertCase) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cases).values(data);
  const result = await db.select().from(cases).where(eq(cases.caseNumber, data.caseNumber)).limit(1);
  return result[0];
}

export async function getCasesByOfficer(officerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cases).where(eq(cases.officerId, officerId)).orderBy(desc(cases.createdAt));
}

export async function getAllCases() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(cases).orderBy(desc(cases.createdAt));
}

export async function getCaseById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.id, id)).limit(1);
  return result[0];
}

export async function getCaseByQrToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cases).where(eq(cases.qrToken, token)).limit(1);
  return result[0];
}

export async function updateCaseStatus(id: number, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cases).set({ status: status as any }).where(eq(cases.id, id));
}

export async function updateCaseNotes(id: number, notes: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(cases).set({ notes }).where(eq(cases.id, id));
}

// ─── Reporters ───────────────────────────────────────────────────────────────
export async function createReporter(data: InsertReporter) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(reporters).values(data);
  const result = await db.select().from(reporters).where(eq(reporters.caseId, data.caseId)).limit(1);
  return result[0];
}

export async function getReporterByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reporters).where(eq(reporters.caseId, caseId)).limit(1);
  return result[0];
}

// ─── Evidence Files ───────────────────────────────────────────────────────────
export async function createEvidenceFile(data: InsertEvidenceFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(evidenceFiles).values(data);
}

export async function getEvidenceFilesByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(evidenceFiles).where(eq(evidenceFiles.caseId, caseId)).orderBy(evidenceFiles.uploadedAt);
}

// ─── OCR Results ─────────────────────────────────────────────────────────────
export async function upsertOcrResult(caseId: number, data: Partial<InsertOcrResult>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(ocrResults).where(eq(ocrResults.caseId, caseId)).limit(1);
  if (existing.length > 0) {
    await db.update(ocrResults).set(data as any).where(eq(ocrResults.caseId, caseId));
  } else {
    await db.insert(ocrResults).values({ caseId, ...data } as InsertOcrResult);
  }
}

export async function getOcrResultByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(ocrResults).where(eq(ocrResults.caseId, caseId)).limit(1);
  return result[0];
}

// ─── Intel Reports ────────────────────────────────────────────────────────────
export async function upsertIntelReport(caseId: number, data: Partial<InsertIntelReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(intelReports).where(eq(intelReports.caseId, caseId)).limit(1);
  if (existing.length > 0) {
    await db.update(intelReports).set(data as any).where(eq(intelReports.caseId, caseId));
  } else {
    await db.insert(intelReports).values({ caseId, ...data } as InsertIntelReport);
  }
}

export async function getIntelReportByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(intelReports).where(eq(intelReports.caseId, caseId)).limit(1);
  return result[0];
}

// ─── Wallet Profiles ──────────────────────────────────────────────────────────
export async function createWalletProfile(data: InsertWalletProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(walletProfiles).values(data);
}

export async function getWalletProfilesByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(walletProfiles).where(eq(walletProfiles.caseId, caseId));
}

export async function deleteWalletProfilesByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(walletProfiles).where(eq(walletProfiles.caseId, caseId));
}

// ─── Interrogation Records ────────────────────────────────────────────────────
export async function upsertInterrogationRecord(caseId: number, data: Partial<InsertInterrogationRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(interrogationRecords).where(eq(interrogationRecords.caseId, caseId)).limit(1);
  if (existing.length > 0) {
    await db.update(interrogationRecords).set(data as any).where(eq(interrogationRecords.caseId, caseId));
  } else {
    await db.insert(interrogationRecords).values({ caseId, ...data } as InsertInterrogationRecord);
  }
}

export async function getInterrogationRecordByCaseId(caseId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(interrogationRecords).where(eq(interrogationRecords.caseId, caseId)).limit(1);
  return result[0];
}

// ─── System Settings ──────────────────────────────────────────────────────────
export async function getSystemSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(systemSettings).where(eq(systemSettings.settingKey, key)).limit(1);
  return result[0]?.settingValue ?? null;
}

export async function upsertSystemSetting(key: string, value: string, description?: string, updatedBy?: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(systemSettings).values({
    settingKey: key,
    settingValue: value,
    description: description ?? null,
    updatedBy: updatedBy ?? null,
  }).onDuplicateKeyUpdate({
    set: { settingValue: value, updatedBy: updatedBy ?? null },
  });
}

export async function getAllSystemSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemSettings);
}
