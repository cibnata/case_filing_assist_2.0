// src/lib/api.js — API 呼叫輔助模組
// OCR 已改為本地 Tesseract.js，此模組僅管理區塊鏈 API

const API_BASE = '/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(errBody.error || errBody.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// Wallet query
export async function lookupWallet(address, chain) {
  return request(`/wallet?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`);
}

// Transaction history
export async function lookupTransactions(address, chain, page = 1, limit = 25) {
  return request(`/transactions?address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}&page=${page}&limit=${limit}`);
}
