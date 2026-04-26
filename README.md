# 詐騙案件受理輔助系統

**派出所報案輔助工具** — 協助員警快速受理詐騙案件，整合 OCR 辨識、情資分析、加密貨幣錢包查詢與調查筆錄自動產生。

---

## 系統簡介

本系統專為派出所員警設計，透過 QR Code 讓民眾自行填寫報案資料並上傳截圖證物，員警端可一站式完成 OCR 辨識、情資分析、錢包查詢，並自動產生調查筆錄草稿，大幅縮短案件受理時間。

---

## 主要功能

| 功能模組 | 說明 |
|----------|------|
| **建案與 QR Code** | 員警建案後自動產生唯一 QR Code，讓民眾掃碼填寫報案資料 |
| **報案人資料填寫** | 民眾掃碼後填寫：姓名、性別、出生年月日、出生地、職業、身分證統一編號、戶籍地址、現住地址、教育程度、電話、家庭經濟狀況（貧寒/勉持/小康/中產/富裕） |
| **證物上傳** | 支援 JPEG/PNG 多張截圖上傳，儲存至 S3 |
| **OCR 辨識** | 整合 Surya OCR 微服務（port 18765）與 VLM fallback，辨識截圖中的文字 |
| **情資分析** | LLM 自動萃取：案件摘要、嫌疑人資訊、相關帳號/網址、事件時序、加密貨幣錢包地址 |
| **錢包查詢** | 查詢 ETH（Etherscan API）與 TRON（Tronscan API）錢包交易紀錄與 TRC-20 明細 |
| **調查筆錄** | LLM 依範本自動產生固定問項答案與 AI 建議追問，可編輯後列印/匯出 PDF |
| **案件報告** | 整合所有資訊，一鍵列印/匯出 PDF |
| **簡易登入** | 帳號密碼相同即可登入（test/test 為管理員），無需 OAuth |

---

## 技術架構

| 層級 | 技術 |
|------|------|
| **前端** | React 19 + Tailwind CSS 4 + shadcn/ui + tRPC 11 |
| **後端** | Express 4 + tRPC 11 + Drizzle ORM |
| **資料庫** | MySQL / TiDB |
| **檔案儲存** | S3（Manus 內建） |
| **OCR** | Surya OCR（Python 微服務）+ VLM fallback |
| **LLM** | Manus 內建 LLM API（invokeLLM） |
| **認證** | 簡易 JWT Session（simpleAuth router） |

---

## 快速開始

```bash
# 安裝依賴
pnpm install

# 推送資料庫 Schema
pnpm db:push

# 啟動開發伺服器
pnpm dev

# 執行測試
pnpm test
```

---

## 路由說明

| 路由 | 說明 | 權限 |
|------|------|------|
| / | 首頁（登入後跳轉 Dashboard） | 需登入 |
| /cases | 案件管理列表 | 需登入 |
| /cases/new | 新建案件 | 需登入 |
| /cases/:id | 案件詳情（6 個 Tab） | 需登入 |
| /cases/:id/interrogation | 調查筆錄 | 需登入 |
| /settings | 系統設定（API Key、單位資訊） | 需登入 |
| /report/:token | 報案人掃碼填寫頁面 | 公開（無需登入） |
| /demo | 示範頁面（假資料預覽） | 公開（無需登入） |

---

## 示範頁面（/demo）

/demo 路由提供完整的假資料展示，無需登入即可瀏覽系統所有主要介面：

- **首頁總覽**：案件統計卡片、最近案件列表
- **案件管理**：5 筆假案件，含各種狀態標籤
- **案件詳情**：6 個 Tab（概覽、證物、OCR 辨識、情資分析、錢包分析、案件報告）
- **調查筆錄**：8 題問答（含 AI 建議追問）

示範模式下所有操作按鈕均已停用，僅供介面預覽。底色為淺藍色，與正式系統（深色主題）有所區別。

---

## 登入方式

| 帳號 | 密碼 | 角色 |
|------|------|------|
| test | test | 管理員（admin） |
| 任意帳號 | 與帳號相同 | 一般員警（user） |

---

## 資料庫 Schema

| 資料表 | 說明 |
|--------|------|
| users | 員警帳號（openId、name、role、unit） |
| cases | 案件主表（案件編號、員警、狀態、QR token） |
| reporters | 報案人資料（完整 12 個欄位） |
| evidence_files | 證物圖片（S3 key、URL、原始檔名） |
| ocr_results | OCR 辨識結果（原始/確認文字） |
| intel_reports | 情資分析報告（JSON 結構） |
| wallet_profiles | 錢包分析（地址、鏈別、交易統計） |
| interrogation_records | 調查筆錄問答（JSON） |
| system_settings | 系統設定（API Key 等） |

---

## 環境變數

系統所需環境變數均由 Manus 平台自動注入，無需手動設定：

- DATABASE_URL：MySQL 連線字串
- JWT_SECRET：Session 簽名金鑰
- BUILT_IN_FORGE_API_KEY：Manus LLM API 金鑰
- BUILT_IN_FORGE_API_URL：Manus LLM API 端點

Etherscan / Tronscan API Key 可於系統設定頁（/settings）輸入，儲存於資料庫。

---

## 測試

```bash
pnpm test
```

目前共 **46 個 Vitest 測試**，涵蓋：

- server/auth.logout.test.ts：登出流程
- server/settings.test.ts：API Key 管理（27 個測試）
- server/simpleAuth.test.ts：簡易登入

---

## 開發紀錄

| Commit | 主要變更 |
|--------|----------|
| 6e3e469 | 新增 /demo 示範頁面（假資料展示，淺藍底色） |
| 1e83520 | 報案人完整欄位更新（11 個欄位，TypeScript 型別修正） |
| e077902 | 移除警號欄位 |
| ac00ef8 | 新增簡易登入、單位設定 |
| a1155f3 | Surya OCR 微服務 port 改為 18765 |

---

## 授權

本專案為內部工具，僅供派出所員警使用。
