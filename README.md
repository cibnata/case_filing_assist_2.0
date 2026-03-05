# ⛓ 受理報案輔助系統

**Case Filing Assistance System — MVP v1.0**

專為台灣警方派出所第一線受理報案設計的數位鑑識輔助工具。透過 AI 影像辨識自動擷取截圖中的加密貨幣錢包地址、交易雜湊、銀行帳號、網址等關鍵情資，降低人工抄錄錯誤，保留完整證據鏈與稽核軌跡。

## 功能特色

- **📤 證據上傳** — 拖拉/點擊上傳手機截圖、網銀畫面、PDF 等證據檔案
- **🔍 AI 辨識擷取** — Claude Vision API 自動辨識並擷取關鍵欄位（錢包地址、TxHash、金額、時間、帳號、網址）
- **✅ 格式驗證** — 加密貨幣地址 Checksum 驗證（BTC/ETH/TRON/LTC）、URL 風險評估、日期合理性檢查
- **👮 人工校對** — 逐欄確認/修改/駁回，含信心分數與驗證狀態
- **📄 一鍵匯出** — 受理摘要複製到剪貼簿、情資清單 CSV 下載
- **📝 稽核日誌** — 全流程操作紀錄，可追溯可稽核

## 系統架構

```
前端（派出所瀏覽器）
  ↓ HTTPS
API Server（案件/證據/匯出）
  ↓ Queue
AI Worker（OCR + 抽取 + 驗證）
  ↓
PostgreSQL + MinIO（資料 + 物件儲存）
```

完整架構圖與資料流圖見 `docs/` 目錄。

## 快速開始

### 本地開發

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 建置生產版本
npm run build
```

### 部署到 Vercel

1. Fork 或 clone 此 repository
2. 在 [Vercel](https://vercel.com) 匯入專案
3. Framework Preset 選擇 **Vite**
4. 點擊 Deploy

## 專案結構

```
case_filing_assist/
├── index.html              # 入口 HTML
├── package.json            # 依賴管理
├── vite.config.js          # Vite 設定
├── vercel.json             # Vercel 部署設定
├── public/
│   └── favicon.svg
├── src/
│   ├── main.jsx            # React 入口
│   └── App.jsx             # 主應用程式（受理報案輔助系統）
└── docs/                   # 開發規格文件
    ├── system-architecture.mermaid  # 系統架構圖
    ├── data-flow.mermaid            # 資料流圖
    ├── db-schema.sql                # PostgreSQL Schema
    ├── api-spec.md                  # API 規格書
    └── extraction-rules.md          # AI 抽取規則表
```

## 技術規格文件

| 文件 | 說明 |
|------|------|
| `docs/system-architecture.mermaid` | 五層系統架構（前端→API→佇列→AI→資料層） |
| `docs/data-flow.mermaid` | 六階段資料流（上傳→OCR→抽取→確認→匯出→移送） |
| `docs/db-schema.sql` | PostgreSQL 10 張核心表（含 RBAC、審計、版本化） |
| `docs/api-spec.md` | 9 組 RESTful API 端點規格 |
| `docs/extraction-rules.md` | BTC/ETH/TRON 驗證規則 + OCR 錯誤修正 + URL 風險評分 |

## 支援的鏈別與驗證

| 鏈別 | 地址格式 | 驗證方式 |
|------|----------|----------|
| Bitcoin (BTC) | 1xxx / 3xxx / bc1xxx | Base58Check / Bech32 |
| Ethereum (ETH) | 0x + 40 hex | EIP-55 Checksum |
| TRON (TRX) | T + 33 chars | Base58Check |
| Litecoin (LTC) | L/M/ltc1 開頭 | Base58Check / Bech32 |

## 開發路線圖

### MVP（目前版本）
- [x] 案件建立與管理
- [x] 證據上傳（圖片）
- [x] AI 辨識擷取（Claude Vision）
- [x] 加密貨幣地址格式驗證
- [x] 人工校對確認流程
- [x] 匯出（剪貼簿 + CSV）
- [x] 稽核日誌

### 正式版（規劃中）
- [ ] 對話紀錄解析（LINE/FB/IG）
- [ ] PDF 證據辨識
- [ ] 原圖定位框回看（Bounding Box Highlight）
- [ ] 相似案件/錢包比對
- [ ] 主管覆核流程
- [ ] 標準化移送 Package
- [ ] 完整後端 API 實作
- [ ] 內網部署方案（Docker Compose）

## 授權

本專案為台灣執法單位內部使用工具。
