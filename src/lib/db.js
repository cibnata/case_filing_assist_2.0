// src/lib/db.js — IndexedDB 持久化資料層
// 使用 Dexie.js 管理案件、證據、欄位、稽核日誌
// 資料存在瀏覽器本地，重新整理不會消失

import Dexie from 'dexie';

const db = new Dexie('CaseFilingAssistDB');

db.version(1).stores({
  cases: 'id, case_number, status, unit, created_at',
  evidence: 'id, case_id, status, uploaded_at',
  fields: 'id, case_id, evidence_id, type, confirmed',
  auditLogs: '++auto_id, case_id, action, created_at',
  settings: 'key',
});

export default db;

// ── Case Operations ──

export async function createCase(caseData) {
  const id = caseData.id || crypto.randomUUID();
  const record = {
    ...caseData,
    id,
    status: caseData.status || 'draft',
    created_at: caseData.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.cases.put(record);
  await addAuditLog(id, 'case_create', '建立案件');
  return record;
}

export async function updateCase(id, updates) {
  await db.cases.update(id, { ...updates, updated_at: new Date().toISOString() });
  return db.cases.get(id);
}

export async function getCase(id) {
  return db.cases.get(id);
}

export async function getAllCases() {
  return db.cases.orderBy('created_at').reverse().toArray();
}

export async function deleteCase(id) {
  await db.transaction('rw', [db.cases, db.evidence, db.fields, db.auditLogs], async () => {
    await db.fields.where('case_id').equals(id).delete();
    await db.evidence.where('case_id').equals(id).delete();
    await db.auditLogs.where('case_id').equals(id).delete();
    await db.cases.delete(id);
  });
}

// ── Evidence Operations ──

export async function addEvidence(evidenceData) {
  const id = evidenceData.id || crypto.randomUUID();
  const record = {
    ...evidenceData,
    id,
    status: 'uploaded',
    uploaded_at: new Date().toISOString(),
  };
  await db.evidence.put(record);
  await addAuditLog(record.case_id, 'evidence_upload', `上傳證據 ${record.evidence_number}: ${record.filename}`);
  return record;
}

export async function updateEvidence(id, updates) {
  await db.evidence.update(id, updates);
  return db.evidence.get(id);
}

export async function getEvidenceByCase(caseId) {
  return db.evidence.where('case_id').equals(caseId).toArray();
}

export async function getEvidence(id) {
  return db.evidence.get(id);
}

// ── Field Operations ──

export async function addFields(fieldsArray) {
  await db.fields.bulkPut(fieldsArray);
}

export async function updateField(id, updates) {
  await db.fields.update(id, updates);
  return db.fields.get(id);
}

export async function getFieldsByCase(caseId) {
  return db.fields.where('case_id').equals(caseId).toArray();
}

export async function getFieldsByEvidence(evidenceId) {
  return db.fields.where('evidence_id').equals(evidenceId).toArray();
}

export async function confirmField(id, confirmedValue, confirmedBy) {
  const field = await db.fields.get(id);
  if (!field) return null;
  const updates = {
    confirmed: true,
    confirmed_value: confirmedValue || field.value,
    confirmed_by: confirmedBy,
    confirmed_at: new Date().toISOString(),
    version: (field.version || 0) + 1,
  };
  await db.fields.update(id, updates);
  await addAuditLog(field.case_id, 'field_confirm', `確認欄位: ${field.type} = ${confirmedValue || field.value}`);
  return { ...field, ...updates };
}

export async function rejectField(id, reason, rejectedBy) {
  const field = await db.fields.get(id);
  if (!field) return null;
  const updates = { rejected: true, reject_reason: reason, rejected_by: rejectedBy, rejected_at: new Date().toISOString() };
  await db.fields.update(id, updates);
  await addAuditLog(field.case_id, 'field_reject', `駁回欄位: ${field.type} = ${field.value} (${reason || '無理由'})`);
  return { ...field, ...updates };
}

// ── Audit Log ──

export async function addAuditLog(caseId, action, detail, user) {
  return db.auditLogs.add({
    case_id: caseId,
    action,
    detail,
    user: user || await getCurrentUser(),
    created_at: new Date().toISOString(),
  });
}

export async function getAuditLogsByCase(caseId) {
  return db.auditLogs.where('case_id').equals(caseId).reverse().sortBy('created_at');
}

// ── Settings / User ──

export async function setCurrentUser(user) {
  await db.settings.put({ key: 'currentUser', value: user });
}

export async function getCurrentUser() {
  const s = await db.settings.get('currentUser');
  return s?.value || '值班員警';
}

// ── Full case load (with evidence + fields + logs) ──

export async function loadFullCase(caseId) {
  const [caseData, evidence, fields, auditLog] = await Promise.all([
    getCase(caseId),
    getEvidenceByCase(caseId),
    getFieldsByCase(caseId),
    getAuditLogsByCase(caseId),
  ]);
  return { ...caseData, evidence, fields, auditLog };
}

// ── Export helper ──

export async function exportCaseData(caseId) {
  const full = await loadFullCase(caseId);
  return JSON.stringify(full, null, 2);
}

// ── DB stats ──

export async function getDBStats() {
  const [cases, evidence, fields, logs] = await Promise.all([
    db.cases.count(),
    db.evidence.count(),
    db.fields.count(),
    db.auditLogs.count(),
  ]);
  return { cases, evidence, fields, logs };
}
