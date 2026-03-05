// src/lib/ocr.js — 本地 OCR 辨識引擎
// Tesseract.js（瀏覽器端 WASM），敏感資料不外流
// + PDF 轉圖（pdf.js）
// + 規則引擎自動擷取情資欄位

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// pdf.js worker 使用 CDN（避免 Vite 打包問題）
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

// ══════════════════════════════════════
// PDF 轉圖片
// ══════════════════════════════════════

/**
 * 將 PDF base64 的每一頁轉為 PNG base64 圖片陣列
 * @param {string} pdfDataUrl - data:application/pdf;base64,... 格式
 * @param {function} onProgress - 進度回調
 * @returns {Promise<string[]>} 每頁的 PNG dataURL
 */
export async function pdfToImages(pdfDataUrl, onProgress) {
  const raw = atob(pdfDataUrl.split(',')[1]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const totalPages = pdf.numPages;
  const images = [];

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress({ status: `轉換 PDF 第 ${i}/${totalPages} 頁...`, progress: Math.round((i / totalPages) * 30) });
    const page = await pdf.getPage(i);
    // 使用 2x scale 以提升 OCR 品質
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/png'));
  }

  return images;
}

/**
 * 判斷 dataURL 是否為 PDF
 */
export function isPDF(dataUrl) {
  return dataUrl && dataUrl.startsWith('data:application/pdf');
}

/**
 * 對 PDF 執行完整 OCR — 每頁轉圖後逐頁辨識再合併
 */
export async function recognizePDF(pdfDataUrl, onProgress) {
  // 1. PDF → images
  const images = await pdfToImages(pdfDataUrl, onProgress);
  if (images.length === 0) throw new Error('PDF 頁數為零');

  // 2. 逐頁 OCR
  let allText = '';
  let allFields = [];
  let totalConfidence = 0;

  for (let i = 0; i < images.length; i++) {
    if (onProgress) onProgress({
      status: `辨識第 ${i + 1}/${images.length} 頁...`,
      progress: 30 + Math.round(((i + 1) / images.length) * 60),
    });

    const result = await recognizeAndExtract(images[i], null); // 不傳 progress 避免覆蓋
    allText += `\n===== 第 ${i + 1} 頁 =====\n${result.ocr_text}\n`;
    allFields = allFields.concat(result.fields);
    totalConfidence += result.raw_confidence;
  }

  // 3. 合併去重
  const seen = new Set();
  const uniqueFields = allFields.filter(f => {
    const key = `${f.type}:${f.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 4. 生成合併摘要
  const summary = generateSummary(allText, uniqueFields);

  if (onProgress) onProgress({ status: '完成', progress: 100 });

  return {
    fields: uniqueFields,
    ocr_text: allText.trim(),
    summary,
    raw_confidence: totalConfidence / images.length,
    word_count: allText.length,
    page_count: images.length,
    page_images: images, // 回傳各頁圖片供預覽
  };
}

// ══════════════════════════════════════
// OCR 引擎狀態管理（Singleton Worker）
// ══════════════════════════════════════

let workerInstance = null;
let workerReady = false;
let initPromise = null;

/**
 * 初始化 Tesseract Worker（只需一次，後續共用）
 * 支援繁體中文 + 英文雙語辨識
 */
export async function initOCR(onProgress) {
  if (workerReady && workerInstance) return workerInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      workerInstance = await Tesseract.createWorker('chi_tra+eng', 1, {
        logger: (m) => {
          if (onProgress && m.progress !== undefined) {
            onProgress({
              status: m.status || 'loading',
              progress: Math.round((m.progress || 0) * 100),
            });
          }
        },
      });

      // 設定 Tesseract 參數以優化截圖辨識
      await workerInstance.setParameters({
        tessedit_pageseg_mode: '6',         // 假設為均勻文字區塊
        preserve_interword_spaces: '1',     // 保留字詞間距
      });

      workerReady = true;
      return workerInstance;
    } catch (err) {
      initPromise = null;
      throw new Error(`OCR 引擎初始化失敗: ${err.message}`);
    }
  })();

  return initPromise;
}

/**
 * 銷毀 Worker（釋放記憶體）
 */
export async function terminateOCR() {
  if (workerInstance) {
    await workerInstance.terminate();
    workerInstance = null;
    workerReady = false;
    initPromise = null;
  }
}

// ══════════════════════════════════════
// 影像預處理（Canvas）
// ══════════════════════════════════════

/**
 * 預處理影像：灰階化 + 對比度增強 + 銳化
 * 提升 OCR 辨識率
 */
export function preprocessImage(imageDataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // 放大小圖以提升辨識率（最小寬度 1200px）
      let scale = 1;
      if (img.width < 1200) {
        scale = 1200 / img.width;
      }
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      // 繪製原圖
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // 灰階化 + 對比度增強
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // 灰階化
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // 對比度增強 (factor=1.5)
        const factor = 1.5;
        const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));

        data[i] = data[i + 1] = data[i + 2] = adjusted;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.src = imageDataUrl;
  });
}

// ══════════════════════════════════════
// 主辨識流程
// ══════════════════════════════════════

/**
 * 執行完整 OCR + 情資擷取流程
 * @param {string} imageDataUrl - base64 影像
 * @param {function} onProgress - 進度回調
 * @returns {object} { fields, ocr_text, summary, word_data }
 */
export async function recognizeAndExtract(imageDataUrl, onProgress) {
  // 1. 影像預處理
  if (onProgress) onProgress({ status: '影像預處理中...', progress: 5 });
  const processed = await preprocessImage(imageDataUrl);

  // 2. 初始化 / 取得 Worker
  if (onProgress) onProgress({ status: '載入 OCR 引擎（首次需下載語言包）...', progress: 10 });
  const worker = await initOCR(onProgress);

  // 3. 執行 OCR
  if (onProgress) onProgress({ status: 'OCR 辨識中...', progress: 40 });
  const result = await worker.recognize(processed);

  const ocrText = result.data.text || '';
  const confidence = result.data.confidence || 0;

  // 4. 同時對原圖辨識（取較好結果）
  let finalText = ocrText;
  let finalConfidence = confidence;

  // 如果預處理版本信心低於 60，也試原圖
  if (confidence < 60) {
    const origResult = await worker.recognize(imageDataUrl);
    if (origResult.data.confidence > confidence) {
      finalText = origResult.data.text || '';
      finalConfidence = origResult.data.confidence || 0;
    }
  }

  // 5. 文字後處理
  if (onProgress) onProgress({ status: '情資擷取中...', progress: 85 });
  const cleanedText = postProcessOCRText(finalText);

  // 6. 規則引擎擷取欄位
  const fields = extractFieldsFromText(cleanedText);

  // 7. 生成摘要
  const summary = generateSummary(cleanedText, fields);

  if (onProgress) onProgress({ status: '完成', progress: 100 });

  return {
    fields,
    ocr_text: cleanedText,
    summary,
    raw_confidence: finalConfidence,
    word_count: cleanedText.length,
  };
}

// ══════════════════════════════════════
// OCR 文字後處理
// ══════════════════════════════════════

function postProcessOCRText(text) {
  if (!text) return '';

  let cleaned = text;

  // 全形轉半形（英數字和常見符號）
  cleaned = cleaned.replace(/[\uff01-\uff5e]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
  cleaned = cleaned.replace(/\u3000/g, ' '); // 全形空白

  // 修正常見 OCR 錯誤（在地址/hash 上下文中）
  // 這些修正只在看起來像是 hex 或 base58 字串中進行
  cleaned = cleaned.replace(
    /(?:0[xX]|^T|^[13]|^bc1|^[LM]|^ltc1)[a-zA-Z0-9]{10,}/gm,
    (match) => {
      // 在可能是地址的字串中修正常見混淆
      return match
        .replace(/[oO](?=[a-fA-F0-9]{5,})/g, '0') // O→0 在 hex 語境
        .replace(/[lI](?=[a-fA-F0-9]{5,})/g, '1'); // l/I→1 在 hex 語境
    }
  );

  // 移除行首行尾多餘空白，合併多餘空行
  cleaned = cleaned
    .split('\n')
    .map(line => line.trim())
    .filter((line, i, arr) => !(line === '' && (arr[i - 1] === '' || i === 0)))
    .join('\n')
    .trim();

  return cleaned;
}

// ══════════════════════════════════════
// 規則引擎：從 OCR 文字中擷取情資欄位
// ══════════════════════════════════════

function extractFieldsFromText(text) {
  if (!text) return [];

  const fields = [];
  const seen = new Set(); // 避免重複

  // ── 1. 加密貨幣錢包地址 ──

  // ETH (0x + 40 hex)
  const ethRegex = /0x[a-fA-F0-9]{40}/g;
  for (const match of text.matchAll(ethRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('wallet_address', match[0], 0.90, findContext(text, match.index), { chain: 'ETH' }));
  }

  // TRON (T + 33 Base58 chars)
  const tronRegex = /T[a-zA-HJ-NP-Z1-9]{33}/g;
  for (const match of text.matchAll(tronRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('wallet_address', match[0], 0.88, findContext(text, match.index), { chain: 'TRON' }));
  }

  // BTC Legacy (1xxx or 3xxx)
  const btcLegacyRegex = /[13][a-km-zA-HJ-NP-Z1-9]{25,34}/g;
  for (const match of text.matchAll(btcLegacyRegex)) {
    const addr = match[0];
    if (seen.has(addr)) continue;
    // 排除誤判：純數字或太短
    if (/^\d+$/.test(addr) || addr.length < 26) continue;
    seen.add(addr);
    fields.push(makeField('wallet_address', addr, 0.85, findContext(text, match.index), { chain: 'BTC' }));
  }

  // BTC Bech32 (bc1...)
  const btcBech32Regex = /bc1[a-zA-HJ-NP-Z0-9]{25,62}/g;
  for (const match of text.matchAll(btcBech32Regex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('wallet_address', match[0], 0.90, findContext(text, match.index), { chain: 'BTC' }));
  }

  // ── 2. 交易雜湊 (TxHash) ──

  // ETH tx hash (0x + 64 hex)
  const ethTxRegex = /0x[a-fA-F0-9]{64}/g;
  for (const match of text.matchAll(ethTxRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('tx_hash', match[0], 0.92, findContext(text, match.index), { chain: 'ETH' }));
  }

  // BTC/TRON tx hash (standalone 64 hex)
  const txHashRegex = /(?<![a-fA-F0-9x])[a-fA-F0-9]{64}(?![a-fA-F0-9])/g;
  for (const match of text.matchAll(txHashRegex)) {
    if (seen.has(match[0])) continue;
    // Skip if already captured as ETH tx
    if (seen.has('0x' + match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('tx_hash', match[0], 0.85, findContext(text, match.index)));
  }

  // ── 3. 網址 ──

  const urlRegex = /https?:\/\/[^\s<>"'，。、；：！？）】」』\]]{5,}/gi;
  for (const match of text.matchAll(urlRegex)) {
    let url = match[0].replace(/[.,;:!?)]+$/, ''); // 移除尾部標點
    if (seen.has(url)) continue;
    seen.add(url);
    fields.push(makeField('url', url, 0.88, findContext(text, match.index)));
  }

  // ── 4. 銀行帳號（台灣格式）──

  // 帶有銀行代碼的格式 (3碼銀行代碼 + 帳號)
  const bankFullRegex = /(?:銀行|帳[號戶]|匯入|轉入|收款|轉帳)[^\n]{0,10}?(\d{3}[-\s]?\d{10,14})/g;
  for (const match of text.matchAll(bankFullRegex)) {
    const acct = match[1].replace(/[-\s]/g, '');
    if (seen.has(acct)) continue;
    seen.add(acct);
    fields.push(makeField('bank_account', acct, 0.82, findContext(text, match.index)));
  }

  // 獨立的長數字串（可能是帳號，10-16碼）
  const acctRegex = /(?:帳[號戶]|Account)[^\n]{0,15}?(\d{10,16})/gi;
  for (const match of text.matchAll(acctRegex)) {
    const acct = match[1];
    if (seen.has(acct)) continue;
    // 避免抓到電話或其他數字
    if (/^09\d{8}$/.test(acct)) continue;
    seen.add(acct);
    fields.push(makeField('bank_account', acct, 0.75, findContext(text, match.index)));
  }

  // ── 5. 電話號碼（台灣）──

  const phoneRegex = /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g;
  for (const match of text.matchAll(phoneRegex)) {
    const phone = match[0].replace(/[-\s]/g, '');
    if (seen.has(phone)) continue;
    seen.add(phone);
    fields.push(makeField('phone_number', match[0], 0.90, findContext(text, match.index)));
  }

  // 市話
  const landlineRegex = /0[2-8][-\s]?\d{4}[-\s]?\d{4}/g;
  for (const match of text.matchAll(landlineRegex)) {
    const phone = match[0].replace(/[-\s]/g, '');
    if (seen.has(phone)) continue;
    seen.add(phone);
    fields.push(makeField('phone_number', match[0], 0.85, findContext(text, match.index)));
  }

  // ── 6. 日期時間 ──

  // 西元年 YYYY/MM/DD HH:MM:SS or YYYY-MM-DD
  const datetimeRegex = /20[2-3]\d[/.\-]\d{1,2}[/.\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g;
  for (const match of text.matchAll(datetimeRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('datetime', match[0], 0.88, findContext(text, match.index)));
  }

  // 民國年 (1XX/MM/DD)
  const rocDateRegex = /1[0-1]\d[/.\-]\d{1,2}[/.\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/g;
  for (const match of text.matchAll(rocDateRegex)) {
    const rocYear = parseInt(match[0].split(/[/.\-]/)[0]);
    if (rocYear >= 100 && rocYear <= 120) { // 民國 100-120 年 (2011-2031)
      if (seen.has(match[0])) continue;
      seen.add(match[0]);
      fields.push(makeField('datetime', match[0], 0.82, `民國 ${rocYear} 年 = 西元 ${rocYear + 1911} 年`));
    }
  }

  // 中文日期
  const cnDateRegex = /20[2-3]\d年\d{1,2}月\d{1,2}日(?:\s*\d{1,2}[時:]\d{2}(?:[分:]\d{2}[秒]?)?)?/g;
  for (const match of text.matchAll(cnDateRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('datetime', match[0], 0.90, findContext(text, match.index)));
  }

  // ── 7. 金額 ──

  // 帶幣種的金額
  const amountPatterns = [
    /(?:USDT|USDC|ETH|BTC|TRX|TWD|NTD|USD)\s*[:：]?\s*([\d,]+\.?\d*)/gi,
    /([\d,]+\.?\d*)\s*(?:USDT|USDC|ETH|BTC|TRX|TWD|NTD|USD|元|台幣)/gi,
    /(?:金額|Amount|轉帳|匯款|交易)[^\n]{0,10}?([\d,]+\.?\d+)\s*(USDT|ETH|BTC|TRX|TWD|元)?/gi,
    /(?:NT\$|＄|\$)\s*([\d,]+\.?\d*)/g,
  ];

  for (const regex of amountPatterns) {
    for (const match of text.matchAll(regex)) {
      const fullMatch = match[0].trim();
      if (seen.has(fullMatch)) continue;
      // 排除太短或是 0 的金額
      const numStr = (match[1] || '').replace(/,/g, '');
      if (!numStr || parseFloat(numStr) === 0) continue;
      seen.add(fullMatch);
      fields.push(makeField('amount', fullMatch, 0.80, findContext(text, match.index)));
    }
  }

  // ── 8. Email ──

  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  for (const match of text.matchAll(emailRegex)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    fields.push(makeField('email', match[0], 0.90, findContext(text, match.index)));
  }

  // ── 9. LINE ID ──

  const lineIdRegex = /(?:LINE\s*(?:ID)?|line\s*(?:id)?)[^\n]{0,5}?[:：]?\s*([a-z0-9_.]{4,20})/gi;
  for (const match of text.matchAll(lineIdRegex)) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    fields.push(makeField('line_id', match[1], 0.78, findContext(text, match.index)));
  }

  // ── 10. 交易所帳號 / UID ──

  const uidRegex = /(?:UID|User\s*ID|帳號|用戶)[^\n]{0,5}?[:：]?\s*(\d{6,12})/gi;
  for (const match of text.matchAll(uidRegex)) {
    const uid = match[1];
    if (seen.has(uid)) continue;
    if (/^09\d{8}$/.test(uid)) continue; // 排除手機號
    seen.add(uid);
    fields.push(makeField('other', uid, 0.70, `可能的交易所 UID: ${findContext(text, match.index)}`));
  }

  return fields;
}

// ══════════════════════════════════════
// 輔助函數
// ══════════════════════════════════════

function makeField(type, value, confidence, context, attributes = {}) {
  return { type, value, confidence, context: context || '', attributes };
}

/**
 * 擷取匹配位置前後的脈絡文字（前後各 30 字）
 */
function findContext(text, matchIndex) {
  if (matchIndex === undefined) return '';
  const start = Math.max(0, matchIndex - 30);
  const end = Math.min(text.length, matchIndex + 60);
  let ctx = text.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) ctx = '…' + ctx;
  if (end < text.length) ctx += '…';
  return ctx;
}

/**
 * 根據擷取結果自動生成摘要
 */
function generateSummary(text, fields) {
  const parts = [];

  const wallets = fields.filter(f => f.type === 'wallet_address');
  const txHashes = fields.filter(f => f.type === 'tx_hash');
  const amounts = fields.filter(f => f.type === 'amount');
  const urls = fields.filter(f => f.type === 'url');
  const phones = fields.filter(f => f.type === 'phone_number');
  const banks = fields.filter(f => f.type === 'bank_account');
  const dates = fields.filter(f => f.type === 'datetime');

  if (wallets.length > 0) {
    const chains = [...new Set(wallets.map(w => w.attributes?.chain || '未知'))].join('/');
    parts.push(`發現 ${wallets.length} 個加密貨幣地址 (${chains})`);
  }
  if (txHashes.length > 0) parts.push(`${txHashes.length} 個交易雜湊`);
  if (amounts.length > 0) parts.push(`${amounts.length} 筆金額`);
  if (banks.length > 0) parts.push(`${banks.length} 個銀行帳號`);
  if (urls.length > 0) parts.push(`${urls.length} 個網址`);
  if (phones.length > 0) parts.push(`${phones.length} 個電話號碼`);
  if (dates.length > 0) parts.push(`${dates.length} 個時間紀錄`);

  if (parts.length === 0) {
    if (text.length > 10) {
      return `OCR 辨識到 ${text.length} 個字元，但未偵測到已知的情資格式。可手動檢視 OCR 文字。`;
    }
    return '未偵測到可辨識的文字內容。請確認圖片清晰度。';
  }

  return `截圖中辨識到：${parts.join('、')}。共 ${fields.length} 個欄位待確認。`;
}

// ══════════════════════════════════════
// 匯出
// ══════════════════════════════════════

export { extractFieldsFromText, postProcessOCRText };
