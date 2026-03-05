import { useState, useCallback, useRef, useEffect } from "react";
import db, { createCase, getAllCases, loadFullCase, addEvidence, getEvidence, updateEvidence, addFields, updateField, confirmField as dbConfirmField, rejectField as dbRejectField, addAuditLog, updateCase, deleteCase } from "./lib/db.js";
import { detectChain, validateField, validateBase58CheckAsync } from "./lib/validate.js";
import { lookupWallet, lookupTransactions } from "./lib/api.js";
import { recognizeAndExtract, recognizePDF, isPDF, pdfToImages, initOCR, terminateOCR } from "./lib/ocr.js";

/* ── Fonts & Constants ── */
const MONO = `"Source Code Pro","JetBrains Mono","SF Mono",Consolas,monospace`;
const SANS = `"Noto Sans TC","PingFang TC","Microsoft JhengHei",-apple-system,sans-serif`;

const FIELD_LABELS = {
  wallet_address: { label: "錢包地址", icon: "🔗", color: "#A78BFA" },
  tx_hash: { label: "交易雜湊", icon: "🔖", color: "#60A5FA" },
  bank_account: { label: "銀行帳號", icon: "🏦", color: "#34D399" },
  url: { label: "網址", icon: "🌐", color: "#F472B6" },
  phone_number: { label: "電話", icon: "📞", color: "#FBBF24" },
  datetime: { label: "日期時間", icon: "🕐", color: "#38BDF8" },
  amount: { label: "金額", icon: "💰", color: "#FB923C" },
  line_id: { label: "LINE ID", icon: "💬", color: "#22C55E" },
  email: { label: "電子郵件", icon: "📧", color: "#818CF8" },
  other: { label: "其他", icon: "📋", color: "#94A3B8" },
};

const CHAIN_COLORS = { ETH: "#627EEA", BTC: "#F7931A", TRON: "#FF0013", LTC: "#B8B8B8" };
const VALIDATION_LABELS = {
  valid: { label: "通過", color: "#22C55E", bg: "#22C55E18" },
  invalid: { label: "失敗", color: "#EF4444", bg: "#EF444418" },
  warning: { label: "警告", color: "#F59E0B", bg: "#F59E0B18" },
  unchecked: { label: "未驗證", color: "#64748B", bg: "#64748B18" },
};
const STATUS_MAP = {
  draft: { label: "草稿", color: "#64748B" }, processing: { label: "處理中", color: "#3B82F6" },
  pending_review: { label: "待校對", color: "#F59E0B" }, confirmed: { label: "已確認", color: "#22C55E" },
  exported: { label: "已匯出", color: "#8B5CF6" },
};
const C = {
  bg: "#060A12", bg1: "#0B1120", bg2: "#111827", bg3: "#1E293B",
  border: "#1E293B", text: "#CBD5E1", textLight: "#94A3B8", textDim: "#475569", textBright: "#F1F5F9",
  accent: "#3B82F6", accentDark: "#1D4ED8", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444",
};

const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10);
const nowStr = () => new Date().toLocaleString("zh-TW", { hour12: false, timeZone: "Asia/Taipei" });

/* ══════════════════════════════════════ */
/* Main App                               */
/* ══════════════════════════════════════ */

export default function CaseFilingSystem() {
  const [view, setView] = useState("list");
  const [cases, setCases] = useState([]);
  const [activeCase, setActiveCase] = useState(null);
  const [activeTab, setActiveTab] = useState("evidence");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("值班員警");
  const [showSettings, setShowSettings] = useState(false);

  // Load cases from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const all = await getAllCases();
        setCases(all);
      } catch (e) { console.error("Failed to load cases:", e); }
      finally { setLoading(false); }
    })();
  }, []);

  const openCase = async (c) => {
    const full = await loadFullCase(c.id);
    setActiveCase(full);
    setView("workspace");
    setActiveTab("evidence");
  };

  const refreshActiveCase = async () => {
    if (!activeCase) return;
    const full = await loadFullCase(activeCase.id);
    setActiveCase(full);
    // Also update cases list
    const all = await getAllCases();
    setCases(all);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SANS, fontSize: 13 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700;900&family=Source+Code+Pro:wght@400;500;600&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:${C.bg1}} ::-webkit-scrollbar-thumb{background:${C.bg3};border-radius:3px}
        button{cursor:pointer;font-family:${SANS}} button:hover{filter:brightness(1.15)}
        input,textarea,select{font-family:${SANS}}
      `}</style>

      {/* Header */}
      <header style={{ background: "linear-gradient(135deg, #0C1526, #152038)", borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, color: "#fff" }}>⛓</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.textBright, letterSpacing: 1 }}>受理報案輔助系統</div>
          <div style={{ fontSize: 10, color: C.textDim, letterSpacing: 0.5 }}>Case Filing Assistance System v1.0</div>
        </div>
        <div style={{ flex: 1 }} />
        {view === "workspace" && (
          <button onClick={async () => { setView("list"); setActiveCase(null); setCases(await getAllCases()); }} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 14px", color: C.textLight, fontSize: 12, fontWeight: 600 }}>← 案件列表</button>
        )}
        <div onClick={() => setShowSettings(!showSettings)} style={{ background: C.bg2, borderRadius: 6, padding: "6px 12px", fontSize: 11, color: C.textLight, border: `1px solid ${C.border}`, cursor: "pointer", position: "relative" }}>
          👮 {userName}
          {showSettings && (
            <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, zIndex: 100, width: 220 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 11, color: C.textLight, marginBottom: 4 }}>員警姓名</div>
              <input value={userName} onChange={e => setUserName(e.target.value)} style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: "6px 8px", color: C.textBright, fontSize: 12, outline: "none" }} />
            </div>
          )}
        </div>
      </header>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)" }}>
          <Spinner /><span style={{ marginLeft: 12, color: C.textDim }}>載入中...</span>
        </div>
      ) : view === "list" ? (
        <CaseList cases={cases} setCases={setCases} openCase={openCase} userName={userName} />
      ) : (
        <CaseWorkspace caseData={activeCase} refresh={refreshActiveCase} activeTab={activeTab} setActiveTab={setActiveTab} userName={userName} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Case List                              */
/* ══════════════════════════════════════ */

function CaseList({ cases, setCases, openCase, userName }) {
  const [showNew, setShowNew] = useState(false);
  const [newCase, setNewCase] = useState({ case_number: "", title: "", case_type: "fraud", reporter_name: "", unit: "" });

  const handleCreate = async () => {
    if (!newCase.case_number || !newCase.title) return;
    const c = await createCase({ ...newCase, id: uid(), officer_name: userName });
    setCases(await getAllCases());
    setShowNew(false);
    setNewCase({ case_number: "", title: "", case_type: "fraud", reporter_name: "", unit: "" });
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm("確定要刪除此案件？所有證據和欄位都會被刪除。")) return;
    await deleteCase(id);
    setCases(await getAllCases());
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textBright }}>📋 案件列表</h2>
        <span style={{ marginLeft: 12, fontSize: 12, color: C.textDim }}>共 {cases.length} 件（資料儲存於瀏覽器本地 IndexedDB）</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNew(!showNew)} style={{ background: `linear-gradient(135deg, ${C.accent}, ${C.accentDark})`, border: "none", borderRadius: 8, padding: "10px 20px", color: "#fff", fontWeight: 600, fontSize: 13 }}>+ 建立新案件</button>
      </div>

      {showNew && (
        <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 20, animation: "fadeIn .3s ease" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textBright, marginBottom: 16 }}>建立新案件</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "報案序號 *", key: "case_number", ph: "NPA-2026-XXXXXX" },
              { label: "案件標題 *", key: "title", ph: "案件摘要描述" },
              { label: "報案人", key: "reporter_name", ph: "報案人姓名" },
              { label: "受理單位", key: "unit", ph: "XX分局XX派出所" },
            ].map(f => (
              <div key={f.key}>
                <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                <input value={newCase[f.key]} onChange={e => setNewCase(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  style={{ width: "100%", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.textBright, fontSize: 13, outline: "none" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button onClick={() => setShowNew(false)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 16px", color: C.textLight, fontSize: 12 }}>取消</button>
            <button onClick={handleCreate} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "8px 20px", color: "#fff", fontSize: 12, fontWeight: 600 }}>建立</button>
          </div>
        </div>
      )}

      {cases.length === 0 ? (
        <div style={{ textAlign: "center", padding: 80, color: C.textDim }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>尚無案件</div>
          <div style={{ fontSize: 13 }}>點擊「建立新案件」開始</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cases.map(c => (
            <div key={c.id} onClick={() => openCase(c)} style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "all .15s" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, color: C.accent, fontWeight: 600 }}>{c.case_number}</span>
                  <StatusBadge status={c.status} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright }}>{c.title}</div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>{c.unit || "—"} ・ 報案人：{c.reporter_name || "—"} ・ {new Date(c.created_at).toLocaleString("zh-TW")}</div>
              </div>
              <button onClick={e => handleDelete(e, c.id)} style={{ background: "transparent", border: `1px solid ${C.danger}33`, borderRadius: 6, padding: "6px 10px", color: C.danger, fontSize: 11 }} title="刪除案件">🗑</button>
              <div style={{ color: C.textDim, fontSize: 18 }}>›</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Case Workspace                         */
/* ══════════════════════════════════════ */

function CaseWorkspace({ caseData, refresh, activeTab, setActiveTab, userName }) {
  if (!caseData) return null;
  const tabs = [
    { key: "evidence", label: "📤 證據管理", count: caseData.evidence?.length },
    { key: "extract", label: "🔍 情資擷取", count: caseData.fields?.length },
    { key: "confirm", label: "✅ 校對確認", count: caseData.fields?.filter(f => !f.confirmed && !f.rejected).length },
    { key: "blockchain", label: "⛓ 鏈上查詢" },
    { key: "export", label: "📄 匯出送交" },
    { key: "audit", label: "📝 稽核日誌", count: caseData.auditLog?.length },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      <div style={{ background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, color: C.accent, fontWeight: 600 }}>{caseData.case_number}</span>
        <StatusBadge status={caseData.status} />
        <span style={{ fontSize: 15, fontWeight: 700, color: C.textBright }}>{caseData.title}</span>
      </div>
      <div style={{ display: "flex", background: C.bg1, borderBottom: `1px solid ${C.border}`, padding: "0 24px", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: "12px 16px", background: "transparent", border: "none",
            borderBottom: activeTab === t.key ? `2px solid ${C.accent}` : "2px solid transparent",
            color: activeTab === t.key ? C.textBright : C.textDim, fontWeight: 600, fontSize: 12, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {t.label}
            {t.count > 0 && <span style={{ background: activeTab === t.key ? C.accent : C.bg3, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{t.count}</span>}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {activeTab === "evidence" && <EvidenceTab caseData={caseData} refresh={refresh} userName={userName} />}
        {activeTab === "extract" && <ExtractTab caseData={caseData} refresh={refresh} userName={userName} />}
        {activeTab === "confirm" && <ConfirmTab caseData={caseData} refresh={refresh} userName={userName} />}
        {activeTab === "blockchain" && <BlockchainTab caseData={caseData} />}
        {activeTab === "export" && <ExportTab caseData={caseData} refresh={refresh} userName={userName} />}
        {activeTab === "audit" && <AuditTab caseData={caseData} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Evidence Tab                           */
/* ══════════════════════════════════════ */

function EvidenceTab({ caseData, refresh, userName }) {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(null); // { status, progress }
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // IDs of evidence waiting for OCR
  const [ocrQueue, setOcrQueue] = useState([]);

  const handleFiles = useCallback(async (files) => {
    const newIds = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/") && f.type !== "application/pdf") continue;
      const base64 = await fileToBase64(f);
      const id = uid();
      await addEvidence({
        id, case_id: caseData.id,
        evidence_number: `E-${String((caseData.evidence?.length || 0) + i + 1).padStart(3, "0")}`,
        filename: f.name, file_type: f.type.startsWith("image/") ? "screenshot" : "pdf_document",
        mime_type: f.type, file_size: f.size,
        preview: base64,
        status: "uploaded",
      });
      newIds.push(id);
    }
    await refresh();
    // Queue all new uploads for auto-OCR
    setOcrQueue(prev => [...prev, ...newIds]);
  }, [caseData, refresh]);

  // Auto-process OCR queue: when queue has items and not currently processing
  useEffect(() => {
    if (processing || ocrQueue.length === 0) return;
    const nextId = ocrQueue[0];
    (async () => {
      const ev = await getEvidence(nextId);
      if (ev && ev.preview && (ev.status === 'uploaded' || ev.status === 'failed')) {
        setSelected(nextId);
        await runOCRInternal(ev);
      }
      // Remove processed item from queue, trigger next
      setOcrQueue(prev => prev.slice(1));
    })();
  }, [ocrQueue, processing]);

  // Click evidence: auto-OCR if not yet processed
  const handleSelectEvidence = useCallback(async (evId) => {
    setSelected(evId);
    if (processing) return;
    const ev = caseData.evidence?.find(e => e.id === evId);
    if (ev && (ev.status === 'uploaded' || ev.status === 'failed')) {
      await runOCRInternal(ev);
    }
  }, [caseData, processing]);

  const runOCRInternal = async (ev) => {
    if (!ev.preview) return;
    setProcessing(ev.id); setError(null); setOcrProgress({ status: '準備中...', progress: 0 });
    try {
      await addAuditLog(caseData.id, "ocr_start", `開始辨識 ${ev.evidence_number} (Tesseract.js 本地引擎)`, userName);

      let result;

      if (isPDF(ev.preview)) {
        // PDF: 先用 pdf.js 轉圖再逐頁 OCR
        result = await recognizePDF(ev.preview, setOcrProgress);
        // 儲存第一頁圖片作為預覽用
        if (result.page_images && result.page_images.length > 0) {
          await updateEvidence(ev.id, { page_preview: result.page_images[0] });
        }
      } else {
        // 圖片: 直接 OCR
        result = await recognizeAndExtract(ev.preview, setOcrProgress);
      }

      // 用驗證模組對每個欄位做真實的 checksum 驗證
      const newFields = (result.fields || []).map(f => {
        const chain = f.type === "wallet_address" ? (f.attributes?.chain || detectChain(f.value)) : null;
        const v = validateField(f.type, f.value, { chain });
        return {
          id: uid(), case_id: caseData.id, evidence_id: ev.id,
          evidence_number: ev.evidence_number,
          type: f.type, value: f.value, confidence: f.confidence || 0.5,
          context: f.context || "", attributes: { ...f.attributes, chain },
          validation: v, confirmed: false, method: isPDF(ev.preview) ? "pdf_tesseract" : "tesseract_regex",
        };
      });

      await addFields(newFields);
      await updateEvidence(ev.id, {
        status: "extracted",
        ocr_text: result.ocr_text,
        summary: result.summary,
        ocr_confidence: result.raw_confidence,
        page_count: result.page_count || 1,
      });
      await updateCase(caseData.id, { status: "pending_review" });
      await addAuditLog(caseData.id, "ocr_complete",
        `${ev.evidence_number} 辨識完成 (${result.page_count ? result.page_count + '頁, ' : ''}信心 ${Math.round(result.raw_confidence)}%)，擷取 ${newFields.length} 個欄位`, userName);
      await refresh();
    } catch (err) {
      setError(`辨識失敗: ${err.message}`);
      await updateEvidence(ev.id, { status: "failed" });
      await addAuditLog(caseData.id, "ocr_fail", `${ev.evidence_number} 辨識失敗: ${err.message}`, userName);
      await refresh();
    } finally { setProcessing(null); setOcrProgress(null); }
  };

  // Find selected evidence's full data
  const selEv = selected ? caseData.evidence?.find(e => e.id === selected) : null;
  const selFields = selEv ? (caseData.fields || []).filter(f => f.evidence_id === selEv.id) : [];

  return (
    <div style={{ display: "flex", gap: 20, height: "100%" }}>
      <div style={{ width: 360, minWidth: 360, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Upload zone */}
        <div style={{ border: `2px dashed ${dragActive ? C.accent : C.border}`, borderRadius: 12, padding: 28, textAlign: "center", cursor: "pointer", background: dragActive ? `${C.accent}08` : C.bg1, transition: "all .2s" }}
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={e => handleFiles(e.target.files)} />
          <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
          <div style={{ color: C.textLight, fontSize: 13, fontWeight: 600 }}>拖放或點擊上傳證據</div>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>支援截圖、照片、PDF（可多檔）</div>
        </div>

        {error && <div style={{ padding: "10px 14px", background: "#7F1D1D33", border: "1px solid #991B1B", borderRadius: 8, color: "#FCA5A5", fontSize: 12 }}>⚠ {error}</div>}

        <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, letterSpacing: 1 }}>證據清單 ({caseData.evidence?.length || 0})</div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {(caseData.evidence || []).map(ev => (
            <div key={ev.id} onClick={() => handleSelectEvidence(ev.id)} style={{
              background: selected === ev.id ? `${C.accent}12` : C.bg1,
              border: `1px solid ${selected === ev.id ? C.accent : C.border}`,
              borderRadius: 8, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
            }}>
              {ev.preview && !isPDF(ev.preview) ? <img src={ev.preview} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover" }} /> :
                <div style={{ width: 40, height: 40, borderRadius: 4, background: isPDF(ev.preview) ? "#1E3A5F" : C.bg3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{isPDF(ev.preview) ? "📄" : "📎"}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textBright }}>{ev.evidence_number}</div>
                <div style={{ fontSize: 11, color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.filename}</div>
              </div>
              <EvStatusBadge status={ev.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Right detail */}
      <div style={{ flex: 1, background: C.bg1, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "auto" }}>
        {selEv ? (
          <div style={{ padding: 20, animation: "fadeIn .3s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.textBright }}>{selEv.evidence_number} — {selEv.filename}</span>
              <EvStatusBadge status={selEv.status} />
              <div style={{ flex: 1 }} />
              {selEv.preview && selEv.status === "uploaded" && (
                <button onClick={() => runOCRInternal(selEv)} disabled={!!processing} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  {processing === selEv.id ? <><Spinner /> {ocrProgress?.status || '辨識中...'} {ocrProgress?.progress ? `${ocrProgress.progress}%` : ''}</> : "🔍 OCR 辨識擷取"}
                </button>
              )}
              {selEv.status === "failed" && (
                <button onClick={() => runOCRInternal(selEv)} disabled={!!processing} style={{ background: C.warning, border: "none", borderRadius: 6, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12 }}>🔄 重新辨識</button>
              )}
            </div>
            {/* OCR Progress Bar */}
            {processing === selEv?.id && ocrProgress && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.textLight }}>{ocrProgress.status}</span>
                  <span style={{ fontSize: 11, color: C.accent, fontWeight: 600 }}>{ocrProgress.progress}%</span>
                </div>
                <div style={{ width: "100%", height: 6, background: C.bg3, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${ocrProgress.progress}%`, height: "100%", background: `linear-gradient(90deg, ${C.accent}, ${C.accentDark})`, borderRadius: 3, transition: "width 0.3s ease" }} />
                </div>
                <div style={{ fontSize: 10, color: C.textDim, marginTop: 4 }}>
                  {ocrProgress.progress < 30 ? "首次使用需下載繁體中文語言包（約 10MB），之後會快取" :
                   ocrProgress.progress < 80 ? "Tesseract.js 本地辨識中，資料不會離開您的瀏覽器" :
                   "正在用規則引擎擷取情資欄位..."}
                </div>
              </div>
            )}
            {selEv.preview && (
              <div style={{ marginBottom: 16, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}`, background: "#000", textAlign: "center" }}>
                {isPDF(selEv.preview) ? (
                  selEv.page_preview ? (
                    <img src={selEv.page_preview} alt="PDF 第一頁" style={{ maxWidth: "100%", maxHeight: 350, objectFit: "contain" }} />
                  ) : (
                    <div style={{ padding: 40, color: C.textDim }}>
                      <div style={{ fontSize: 48, marginBottom: 8 }}>📄</div>
                      <div style={{ fontSize: 13 }}>PDF 文件 — 點擊辨識按鈕後自動轉換為圖片並 OCR</div>
                      <div style={{ fontSize: 11, marginTop: 4, color: C.textDim }}>{selEv.filename} ({selEv.page_count ? `${selEv.page_count} 頁` : '頁數待偵測'})</div>
                    </div>
                  )
                ) : (
                  <img src={selEv.preview} alt="" style={{ maxWidth: "100%", maxHeight: 350, objectFit: "contain" }} />
                )}
              </div>
            )}
            {selEv.summary && (
              <div style={{ background: C.bg2, borderRadius: 8, padding: "12px 16px", marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 4 }}>內容摘要</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{selEv.summary}</div>
                {selEv.ocr_confidence !== undefined && (
                  <div style={{ fontSize: 10, color: C.textDim, marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🔧 Tesseract.js（本地）</span>
                    <span>繁中+英文</span>
                    <span>信心 {Math.round(selEv.ocr_confidence)}%</span>
                  </div>
                )}
              </div>
            )}
            {selEv.ocr_text && (
              <div style={{ background: C.bg2, borderRadius: 8, padding: "12px 16px", marginBottom: 12, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 4 }}>OCR 辨識文字</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{selEv.ocr_text}</div>
              </div>
            )}
            {selFields.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.textLight, marginBottom: 8 }}>擷取欄位 ({selFields.length})</div>
                {selFields.map(f => <FieldCard key={f.id} field={f} compact />)}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDim, textAlign: "center" }}>
            <div><div style={{ fontSize: 40, marginBottom: 12 }}>📎</div><div style={{ fontSize: 14, fontWeight: 600 }}>選擇左側的證據查看詳情</div></div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Extract Tab                            */
/* ══════════════════════════════════════ */

function ExtractTab({ caseData, refresh, userName }) {
  const fields = caseData.fields || [];
  const grouped = {};
  fields.forEach(f => { (grouped[f.type] = grouped[f.type] || []).push(f); });

  const [manualType, setManualType] = useState("wallet_address");
  const [manualValue, setManualValue] = useState("");

  const addManual = async () => {
    const v = manualValue.trim();
    if (!v) return;
    const chain = manualType === "wallet_address" ? detectChain(v) : null;
    const val = validateField(manualType, v, { chain });
    await addFields([{
      id: uid(), case_id: caseData.id, evidence_id: null, evidence_number: "手動",
      type: manualType, value: v, confidence: 1.0, context: "手動輸入",
      attributes: { chain }, validation: val, confirmed: false, method: "manual",
    }]);
    await addAuditLog(caseData.id, "field_manual", `手動新增 ${FIELD_LABELS[manualType]?.label}: ${v}`, userName);
    setManualValue("");
    await refresh();
  };

  return (
    <div style={{ maxWidth: 900, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textBright }}>🔍 情資擷取結果</h3>
        <span style={{ fontSize: 12, color: C.textDim }}>共 {fields.length} 個欄位</span>
      </div>
      {/* Manual add */}
      <div style={{ background: C.bg1, borderRadius: 10, padding: 16, border: `1px solid ${C.border}`, marginBottom: 20, display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 4 }}>欄位類型</div>
          <select value={manualType} onChange={e => setManualType(e.target.value)} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.textBright, fontSize: 12, outline: "none" }}>
            {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.textLight, fontWeight: 600, marginBottom: 4 }}>值</div>
          <input value={manualValue} onChange={e => setManualValue(e.target.value)} placeholder="手動輸入..."
            onKeyDown={e => e.key === "Enter" && addManual()}
            style={{ width: "100%", background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.textBright, fontSize: 12, fontFamily: MONO, outline: "none" }} />
        </div>
        <button onClick={addManual} style={{ background: C.accent, border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12 }}>+ 加入</button>
      </div>
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14 }}>{FIELD_LABELS[type]?.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: FIELD_LABELS[type]?.color || C.textLight }}>{FIELD_LABELS[type]?.label || type}</span>
            <span style={{ fontSize: 11, color: C.textDim }}>({items.length})</span>
          </div>
          {items.map(f => <FieldCard key={f.id} field={f} />)}
        </div>
      ))}
      {fields.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: C.textDim }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14 }}>尚未擷取任何情資，請先至「證據管理」上傳並辨識截圖</div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Confirm Tab                            */
/* ══════════════════════════════════════ */

function ConfirmTab({ caseData, refresh, userName }) {
  const fields = caseData.fields || [];
  const pending = fields.filter(f => !f.confirmed && !f.rejected);
  const confirmed = fields.filter(f => f.confirmed);
  const rejected = fields.filter(f => f.rejected);

  const handleConfirm = async (id, value) => {
    await dbConfirmField(id, value, userName);
    await refresh();
  };
  const handleReject = async (id) => {
    await dbRejectField(id, "", userName);
    await refresh();
  };
  const confirmAll = async () => {
    const validPending = pending.filter(f => f.validation?.status !== "invalid");
    for (const f of validPending) await dbConfirmField(f.id, f.value, userName);
    await refresh();
  };

  return (
    <div style={{ maxWidth: 900, animation: "fadeIn .3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textBright }}>✅ 人工校對確認</h3>
        <div style={{ flex: 1 }} />
        {pending.length > 0 && (
          <button onClick={confirmAll} style={{ background: C.success, border: "none", borderRadius: 6, padding: "8px 18px", color: "#fff", fontWeight: 600, fontSize: 12 }}>✓ 全部確認（排除驗證失敗）</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatCard label="待確認" value={pending.length} color={C.warning} />
        <StatCard label="已確認" value={confirmed.length} color={C.success} />
        <StatCard label="已駁回" value={rejected.length} color={C.danger} />
      </div>
      {pending.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.warning, marginBottom: 10 }}>⏳ 待確認</div>
          {pending.map(f => <ConfirmFieldCard key={f.id} field={f} onConfirm={handleConfirm} onReject={handleReject} />)}
        </div>
      )}
      {confirmed.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.success, marginBottom: 10 }}>✓ 已確認 ({confirmed.length})</div>
          {confirmed.map(f => <FieldCard key={f.id} field={f} compact showConfirm />)}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Blockchain Tab — Real chain lookups    */
/* ══════════════════════════════════════ */

function BlockchainTab({ caseData }) {
  const walletFields = (caseData.fields || []).filter(f => f.type === "wallet_address" && f.confirmed);
  const [selectedAddr, setSelectedAddr] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [txData, setTxData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState("info");

  const doWalletLookup = async (addr, chain) => {
    setSelectedAddr(addr); setWalletData(null); setTxData(null); setError(null);
    setWalletLoading(true); setActiveSubTab("info");
    try {
      const data = await lookupWallet(addr, chain);
      setWalletData(data);
    } catch (e) { setError(`錢包查詢失敗: ${e.message}`); }
    finally { setWalletLoading(false); }
  };

  const doTxLookup = async (addr, chain) => {
    setTxLoading(true); setError(null); setActiveSubTab("tx");
    try {
      const data = await lookupTransactions(addr, chain);
      setTxData(data);
    } catch (e) { setError(`交易查詢失敗: ${e.message}`); }
    finally { setTxLoading(false); }
  };

  const exportTxCSV = () => {
    if (!txData?.transactions?.length) return;
    const BOM = "\uFEFF";
    const h = ["交易雜湊", "時間", "方向", "來源", "目標", "金額", "幣種", "手續費", "區塊", "狀態"];
    const rows = txData.transactions.map(tx => [tx.hash, tx.timestamp, tx.direction, tx.from, tx.to, tx.value, tx.token, tx.fee, tx.block, tx.status]);
    const csv = BOM + [h, ...rows].map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `${txData.chain}_${selectedAddr?.slice(0, 10)}_交易紀錄.csv`, "text/csv;charset=utf-8");
  };

  const exportWalletCSV = () => {
    if (!walletData) return;
    const BOM = "\uFEFF";
    const lines = [["欄位", "資料"], ["鏈別", walletData.chain], ["地址", walletData.address], ["餘額", walletData.balance],
      ["交易總數", walletData.total_transactions], ["首次交易", walletData.first_seen], ["最近交易", walletData.last_seen],
      ["標記", walletData.label], ["風險", walletData.risk]];
    if (walletData.token_balances?.length) {
      lines.push(["", ""], ["代幣", "餘額"]);
      walletData.token_balances.forEach(t => lines.push([t.token, t.balance]));
    }
    const csv = BOM + lines.map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `${walletData.chain}_${walletData.address?.slice(0, 10)}_錢包資料.csv`, "text/csv;charset=utf-8");
  };

  return (
    <div style={{ maxWidth: 1100, animation: "fadeIn .3s ease" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textBright, marginBottom: 16 }}>⛓ 鏈上資料查詢</h3>
      {walletFields.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: C.textDim }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⛓</div>
          <div>請先在「校對確認」中確認錢包地址，才能進行鏈上查詢</div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Address list */}
          <div style={{ width: 320, minWidth: 320 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 8 }}>已確認錢包地址</div>
            {walletFields.map(f => (
              <div key={f.id} onClick={() => doWalletLookup(f.confirmed_value || f.value, f.attributes?.chain || detectChain(f.confirmed_value || f.value))} style={{
                background: selectedAddr === (f.confirmed_value || f.value) ? `${C.accent}12` : C.bg1,
                border: `1px solid ${selectedAddr === (f.confirmed_value || f.value) ? C.accent : C.border}`,
                borderRadius: 8, padding: "10px 14px", cursor: "pointer", marginBottom: 6,
              }}>
                <span style={{ background: `${CHAIN_COLORS[f.attributes?.chain] || C.textDim}22`, color: CHAIN_COLORS[f.attributes?.chain] || C.textDim, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700, marginRight: 8 }}>{f.attributes?.chain || "?"}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.textBright, wordBreak: "break-all" }}>{f.confirmed_value || f.value}</span>
              </div>
            ))}
          </div>

          {/* Results */}
          <div style={{ flex: 1 }}>
            {error && <div style={{ padding: "10px 14px", background: "#7F1D1D33", border: "1px solid #991B1B", borderRadius: 8, color: "#FCA5A5", fontSize: 12, marginBottom: 12 }}>⚠ {error}</div>}
            {selectedAddr ? (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {["info", "tx"].map(t => (
                    <button key={t} onClick={() => { setActiveSubTab(t); if (t === "tx" && !txData && !txLoading) { const f = walletFields.find(x => (x.confirmed_value || x.value) === selectedAddr); doTxLookup(selectedAddr, f?.attributes?.chain || "ETH"); } }}
                      style={{ padding: "8px 16px", background: activeSubTab === t ? C.accent : "transparent", border: `1px solid ${activeSubTab === t ? C.accent : C.border}`, borderRadius: 6, color: activeSubTab === t ? "#fff" : C.textLight, fontWeight: 600, fontSize: 12 }}>
                      {t === "info" ? "📊 錢包資料" : "📜 交易紀錄"}
                    </button>
                  ))}
                </div>

                {activeSubTab === "info" && (
                  walletLoading ? <div style={{ textAlign: "center", padding: 40 }}><Spinner /><div style={{ marginTop: 12, color: C.textDim }}>查詢鏈上資料中...</div></div> :
                  walletData ? (
                    <div style={{ animation: "fadeIn .3s ease" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                        {[["主鏈餘額", walletData.balance], ["交易總數", walletData.total_transactions], ["首次交易", walletData.first_seen], ["最近交易", walletData.last_seen], ["標記", walletData.label], ["風險等級", walletData.risk]].map(([l, v]) => (
                          <div key={l} style={{ background: C.bg1, borderRadius: 8, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 11, color: C.textDim, marginBottom: 4 }}>{l}</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.textBright, fontFamily: MONO }}>{v || "—"}</div>
                          </div>
                        ))}
                      </div>
                      {walletData.token_balances?.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: C.textLight, marginBottom: 8 }}>代幣餘額</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {walletData.token_balances.map((t, i) => (
                              <div key={i} style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 14px", fontSize: 13 }}>
                                <span style={{ color: C.textDim, marginRight: 6, fontSize: 11 }}>{t.token}</span>
                                <span style={{ color: C.textBright, fontWeight: 600, fontFamily: MONO }}>{t.balance}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={exportWalletCSV} style={{ background: C.success, border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12 }}>⬇ 下載錢包資料</button>
                        {walletData.explorer_url && <a href={walletData.explorer_url} target="_blank" rel="noopener noreferrer" style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 16px", color: C.textLight, fontWeight: 600, fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>🔗 區塊鏈瀏覽器</a>}
                      </div>
                    </div>
                  ) : null
                )}

                {activeSubTab === "tx" && (
                  txLoading ? <div style={{ textAlign: "center", padding: 40 }}><Spinner /><div style={{ marginTop: 12, color: C.textDim }}>查詢交易紀錄中...</div></div> :
                  txData ? (
                    <div style={{ animation: "fadeIn .3s ease" }}>
                      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 12 }}>共 {txData.total_count} 筆交易（顯示最近 {txData.transactions?.length} 筆）</div>
                      <div style={{ overflowX: "auto", marginBottom: 16 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: MONO }}>
                          <thead>
                            <tr>{["時間", "方向", "來源", "目標", "金額", "幣種", "雜湊"].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: C.textDim, borderBottom: `1px solid ${C.border}`, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {(txData.transactions || []).map((tx, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : `${C.bg1}44` }}>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08`, fontSize: 11, whiteSpace: "nowrap" }}>{tx.timestamp}</td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08` }}>
                                  <span style={{ background: tx.direction === "IN" ? `${C.success}18` : `${C.danger}18`, color: tx.direction === "IN" ? C.success : C.danger, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                                    {tx.direction === "IN" ? "⬇ 轉入" : "⬆ 轉出"}
                                  </span>
                                </td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08`, fontSize: 10, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }} title={tx.from}>{tx.from}</td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08`, fontSize: 10, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }} title={tx.to}>{tx.to}</td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08`, fontWeight: 600, color: C.textBright }}>{tx.value}</td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08` }}>{tx.token}</td>
                                <td style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}08`, fontSize: 10, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }} title={tx.hash}>{tx.hash}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button onClick={exportTxCSV} style={{ background: C.success, border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontWeight: 600, fontSize: 12 }}>⬇ 下載交易紀錄 CSV</button>
                    </div>
                  ) : null
                )}
              </>
            ) : (
              <div style={{ textAlign: "center", padding: 60, color: C.textDim }}>← 選擇一個錢包地址查詢鏈上資料</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Export Tab                             */
/* ══════════════════════════════════════ */

function ExportTab({ caseData, refresh, userName }) {
  const confirmed = (caseData.fields || []).filter(f => f.confirmed);

  const generateSummary = () => {
    const lines = [
      `受理報案摘要`, `═══════════════════════════`,
      `案件編號：${caseData.case_number}`, `案件標題：${caseData.title}`,
      `報案人：${caseData.reporter_name || "—"}`, `受理單位：${caseData.unit || "—"}`,
      `建立時間：${new Date(caseData.created_at).toLocaleString("zh-TW")}`, ``,
      `▎ 情資清單 (已確認 ${confirmed.length} 項)`, `───────────────────────────`,
    ];
    const grouped = {};
    confirmed.forEach(f => { (grouped[f.type] = grouped[f.type] || []).push(f); });
    Object.entries(grouped).forEach(([type, items]) => {
      const info = FIELD_LABELS[type] || { label: type, icon: "📋" };
      lines.push(`\n${info.icon} ${info.label}：`);
      items.forEach((f, i) => {
        lines.push(`  ${i + 1}. ${f.confirmed_value || f.value}`);
        if (f.context) lines.push(`     脈絡：${f.context}`);
        if (f.validation?.detail) lines.push(`     驗證：${f.validation.detail}`);
      });
    });
    lines.push(`\n═══════════════════════════`, `證據附件：${caseData.evidence?.length || 0} 件`, `匯出時間：${nowStr()}`, `匯出人：${userName}`);
    return lines.join("\n");
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generateSummary());
    await updateCase(caseData.id, { status: "exported" });
    await addAuditLog(caseData.id, "export_generate", "匯出受理摘要（剪貼簿）", userName);
    await refresh();
    alert("已複製到剪貼簿！");
  };

  const downloadCSV = async () => {
    const BOM = "\uFEFF";
    const h = ["欄位類型", "值", "信心分數", "驗證狀態", "驗證細節", "來源證據", "脈絡", "確認人", "確認時間"];
    const rows = confirmed.map(f => [FIELD_LABELS[f.type]?.label || f.type, f.confirmed_value || f.value, f.confidence, f.validation?.status, f.validation?.detail, f.evidence_number, f.context, f.confirmed_by, f.confirmed_at]);
    const csv = BOM + [h, ...rows].map(r => r.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `${caseData.case_number}_情資清單.csv`, "text/csv;charset=utf-8");
    await addAuditLog(caseData.id, "export_generate", "下載情資清單 CSV", userName);
    await refresh();
  };

  return (
    <div style={{ maxWidth: 900, animation: "fadeIn .3s ease" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textBright, marginBottom: 20 }}>📄 匯出與送交</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
        <ExportCard icon="📋" title="一鍵複製摘要" desc="複製格式化的受理摘要到剪貼簿" onClick={copyToClipboard} color={C.accent} />
        <ExportCard icon="📊" title="下載情資 CSV" desc="匯出已確認欄位含驗證與來源追溯" onClick={downloadCSV} color={C.success} />
      </div>
      <div style={{ background: C.bg1, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.textLight }}>受理摘要預覽</div>
        <pre style={{ padding: 16, fontFamily: MONO, fontSize: 12, color: C.text, lineHeight: 1.8, whiteSpace: "pre-wrap", margin: 0, maxHeight: 400, overflow: "auto" }}>{generateSummary()}</pre>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Audit Tab                              */
/* ══════════════════════════════════════ */

function AuditTab({ caseData }) {
  const logs = caseData.auditLog || [];
  const icons = { case_create: "📋", evidence_upload: "📤", ocr_start: "🔄", ocr_complete: "✅", ocr_fail: "❌", field_confirm: "✓", field_reject: "✗", field_manual: "✍️", export_generate: "📄" };

  return (
    <div style={{ maxWidth: 900, animation: "fadeIn .3s ease" }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textBright, marginBottom: 20 }}>📝 稽核日誌 ({logs.length})</h3>
      <div style={{ background: C.bg1, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        {logs.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: C.textDim }}>暫無紀錄</div> :
          logs.map((log, i) => (
            <div key={i} style={{ padding: "12px 16px", borderBottom: `1px solid ${C.border}08`, display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
              <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{icons[log.action] || "📌"}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.textDim, minWidth: 160 }}>{new Date(log.created_at).toLocaleString("zh-TW")}</span>
              <span style={{ color: C.accent, fontWeight: 600, minWidth: 80 }}>{log.user}</span>
              <span style={{ color: C.text, flex: 1 }}>{log.detail}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════ */
/* Shared Components                      */
/* ══════════════════════════════════════ */

function FieldCard({ field, compact, showConfirm }) {
  const info = FIELD_LABELS[field.type] || FIELD_LABELS.other;
  const val = VALIDATION_LABELS[field.validation?.status] || VALIDATION_LABELS.unchecked;
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 8, padding: compact ? "8px 12px" : "12px 16px", marginBottom: 6, borderLeft: `3px solid ${info.color}`, animation: "fadeIn .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ background: `${info.color}18`, color: info.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{info.icon} {info.label}</span>
        {field.attributes?.chain && <span style={{ background: `${CHAIN_COLORS[field.attributes.chain] || C.textDim}22`, color: CHAIN_COLORS[field.attributes.chain] || C.textDim, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{field.attributes.chain}</span>}
        <span style={{ background: val.bg, color: val.color, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{val.label}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>信心 {Math.round((field.confidence || 0) * 100)}%</span>
        {field.evidence_number && <span style={{ fontSize: 10, color: C.textDim }}>📎 {field.evidence_number}</span>}
        {showConfirm && field.confirmed && <span style={{ fontSize: 10, color: C.success }}>✓ {field.confirmed_by} {field.confirmed_at && new Date(field.confirmed_at).toLocaleString("zh-TW")}</span>}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.textBright, marginTop: 6, wordBreak: "break-all", lineHeight: 1.6 }}>{field.confirmed_value || field.value}</div>
      {field.validation?.detail && !compact && <div style={{ fontSize: 11, color: C.textDim, marginTop: 4 }}>驗證：{field.validation.detail}</div>}
      {field.validation?.checks?.length > 0 && !compact && (
        <div style={{ marginTop: 4 }}>
          {field.validation.checks.map((ck, i) => (
            <div key={i} style={{ fontSize: 10, color: ck.passed ? C.success : C.danger }}>
              {ck.passed ? "✓" : "✗"} {ck.rule}: {ck.detail}
            </div>
          ))}
        </div>
      )}
      {field.context && !compact && <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>💬 {field.context}</div>}
    </div>
  );
}

function ConfirmFieldCard({ field, onConfirm, onReject }) {
  const [editValue, setEditValue] = useState(field.value);
  const [editing, setEditing] = useState(false);
  const info = FIELD_LABELS[field.type] || FIELD_LABELS.other;
  const val = VALIDATION_LABELS[field.validation?.status] || VALIDATION_LABELS.unchecked;

  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 8, borderLeft: `3px solid ${info.color}`, animation: "fadeIn .2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ background: `${info.color}18`, color: info.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{info.icon} {info.label}</span>
        {field.attributes?.chain && <span style={{ background: `${CHAIN_COLORS[field.attributes.chain] || "#666"}22`, color: CHAIN_COLORS[field.attributes.chain], padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{field.attributes.chain}</span>}
        <span style={{ background: val.bg, color: val.color, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{val.label}</span>
        <ConfidenceBar value={field.confidence} />
        {field.evidence_number && <span style={{ fontSize: 10, color: C.textDim }}>📎 {field.evidence_number}</span>}
      </div>
      {editing ? (
        <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
          style={{ width: "100%", background: C.bg2, border: `1px solid ${C.accent}`, borderRadius: 6, padding: "8px 12px", color: C.textBright, fontFamily: MONO, fontSize: 12, outline: "none", marginBottom: 8 }} />
      ) : (
        <div style={{ fontFamily: MONO, fontSize: 13, color: C.textBright, wordBreak: "break-all", lineHeight: 1.6, marginBottom: 8, padding: "6px 10px", background: C.bg2, borderRadius: 6 }}>{field.value}</div>
      )}
      {field.validation?.detail && <div style={{ fontSize: 11, color: val.color, marginBottom: 4 }}>⚙ {field.validation.detail}</div>}
      {field.validation?.checks?.map((ck, i) => (
        <div key={i} style={{ fontSize: 10, color: ck.passed ? C.success : C.danger, marginBottom: 2 }}>{ck.passed ? "✓" : "✗"} {ck.rule}: {ck.detail}</div>
      ))}
      {field.context && <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>💬 {field.context}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onConfirm(field.id, editing ? editValue : undefined)} style={{ background: C.success, border: "none", borderRadius: 6, padding: "6px 16px", color: "#fff", fontWeight: 600, fontSize: 12 }}>✓ 確認</button>
        <button onClick={() => setEditing(!editing)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", color: C.textLight, fontSize: 12 }}>{editing ? "取消編輯" : "✏ 修改"}</button>
        <button onClick={() => onReject(field.id)} style={{ background: "transparent", border: `1px solid ${C.danger}44`, borderRadius: 6, padding: "6px 12px", color: C.danger, fontSize: 12 }}>✗ 駁回</button>
        <button onClick={() => navigator.clipboard.writeText(field.value)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 12px", color: C.textLight, fontSize: 12, marginLeft: "auto" }}>📋 複製</button>
      </div>
    </div>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 90 ? C.success : pct >= 70 ? C.warning : C.danger;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 50, height: 4, background: C.bg3, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || "—", color: C.textDim };
  return <span style={{ background: `${s.color}18`, color: s.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>{s.label}</span>;
}

function EvStatusBadge({ status }) {
  const map = { uploaded: { label: "待辨識", color: C.textDim }, extracted: { label: "已擷取", color: C.success }, failed: { label: "失敗", color: C.danger } };
  const s = map[status] || { label: status, color: C.textDim };
  return <span style={{ background: `${s.color}18`, color: s.color, padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{s.label}</span>;
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", flex: 1 }}>
      <div style={{ fontSize: 11, color: C.textDim, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: MONO }}>{value}</div>
    </div>
  );
}

function ExportCard({ icon, title, desc, onClick, color }) {
  return (
    <div onClick={onClick} style={{ background: C.bg1, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, cursor: "pointer", transition: "all .15s" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 14, height: 14, border: `2px solid ${C.accent}33`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin .8s linear infinite" }} />;
}

/* ── Utility ── */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
