# 派出所報案輔助工具 TODO

## Phase 1: 資料庫 Schema
- [x] cases 案件主表（案件編號、受理員警、單位、狀態、QR Code token、建立時間）
- [x] reporters 報案人資料表（姓名、身分證、出生日期、地址、報案類別、關聯案件）
- [x] evidence_files 證物圖片表（S3 key、URL、原始檔名、關聯案件）
- [x] ocr_results OCR 辨識結果表（原始文字、確認文字、確認狀態、關聯案件）
- [x] intel_reports 情資分析報告表（JSON 結構化情資、關聯案件）
- [x] wallet_profiles 錢包分析表（地址、鏈別、交易統計、關聯案件）
- [x] interrogation_records 筆錄問答表（questions JSON、狀態、產生時間）

## Phase 2: 後端核心 API
- [x] POST /cases/create - 建案（帶入員警資訊、產生案件編號、QR Code token）
- [x] GET /cases/list - 案件列表（警員端）
- [x] GET /cases/:id - 案件詳情
- [x] PATCH /cases/:id/status - 更新案件狀態
- [x] GET /cases/qr/:token - 報案人掃碼驗證（公開）
- [x] POST /cases/qr/:token/reporter - 報案人填寫基本資料
- [x] POST /cases/qr/:token/upload - 上傳證物圖片至 S3
- [x] 自動通知：報案人完成上傳後通知受理員警

## Phase 3: OCR 與情資分析 API
- [x] POST /cases/:id/ocr - 對所有證物圖片執行 Surya OCR + VLM
- [x] PATCH /cases/:id/ocr/confirm - 警員確認/編輯 OCR 全文
- [x] POST /cases/:id/analyze - LLM 情資分析（萃取通訊平台、帳號、時序等）
- [x] 情資分析輸出格式：Case Summary / Victim / Suspect / Related Accounts / Timeline / Wallet Profiles / TRC-20 Ledger / Unverified

## Phase 4: 加密貨幣錢包查詢 API
- [x] POST /cases/:id/wallets/query - 查詢 ETH 錢包（Etherscan API）
- [x] POST /cases/:id/wallets/query - 查詢 TRON 錢包（Tronscan API）
- [x] TRC-20 代幣轉帳明細查詢
- [x] 錢包分析結果儲存至 wallet_profiles 表

## Phase 5: 警員端介面
- [x] 登入頁面（Manus OAuth）
- [x] Dashboard 首頁（案件統計概覽）
- [x] 建案頁面（自動帶入員警資訊、產生 QR Code）
- [x] 案件列表頁面（狀態篩選、搜尋）
- [x] 案件詳情頁面（報案人資料、證物、OCR、情資、錢包、報告）

## Phase 6: 報案人掃碼頁面
- [x] 掃碼驗證頁（公開路由，驗證 token 有效性）
- [x] 基本資料填寫表單（姓名、身分證、出生日期、地址、報案類別）
- [x] 證物圖片上傳介面（多圖上傳、預覽）
- [x] 完成確認頁面

## Phase 7: OCR 確認、情資分析、錢包分析、報告輸出
- [x] OCR 辨識觸發與進度顯示
- [x] OCR 全文確認/編輯介面
- [x] 情資分析觸發與結構化結果展示
- [x] 加密貨幣錢包查詢介面
- [x] 案件報告預覽與匯出（PDF/列印）

## Phase 8: 測試與部署
- [x] Vitest 單元測試（12 個測試全部通過）
- [x] Surya OCR Python 微服務整合（port 8765）
- [x] GitHub 推送
- [x] Checkpoint 儲存

## Phase 筆錄產生功能（新增）
- [x] 新增 interrogation_records 資料表（筆錄問答 JSON、狀態、產生時間）
- [x] 後端 API：POST /cases/:id/interrogation/generate - LLM 依範本產生筆錄問答
- [x] 筆錄固定問項（依範本）：
  - 問1：上述年籍資料是否為你本人？
  - 問2：現住地確認與司法通知說明（是否清楚、現住地是否一致）
  - 問3：你今日因何事至所製作筆錄？
  - 問4：你於何時？何地？遭何人詐騙？請詳述詐騙之過程。
  - 問5：歹徒提供投資網站名稱為何？網址為？有無提供 APP 下載連結？
- [x] 固定問項答案由 LLM 依被害人填寫資料與情資自動填入
- [x] AI 建議追問：依情資分析結果（帳號、錢包、平台、時序等）自動產生 3~8 個追問問題
- [x] 筆錄預覽介面：依調查筆錄格式排版，顯示問答對話
- [x] 筆錄可供警員編輯後列印 / 匯出 PDF
- [x] 筆錄表頭帶入：詢問時間、地點、案由、受詢問人基本資料（含家庭經濟狀況）

## API Key 管理功能（已完成）
- [x] 新增 system_settings 資料表（key/value 形式，儲存 ETHERSCAN_API_KEY、TRONSCAN_API_KEY）
- [x] 後端 API：getAll / update / clear / getStatus（限管理員寫入）
- [x] 錢包查詢 router 改為從資料庫讀取 API Key（優先於環境變數）
- [x] Tronscan 查詢加入 TRON-PRO-API-KEY header
- [x] 前端設定頁面：/settings 路由，顯示目前 Key（遮罩）、輸入新 Key、儲存確認
- [x] 側邊欄加入「系統設定」導覽項目
- [x] Vitest 測試：settings.getAll / update / getStatus（17 個測試全部通過）

## API Key 測試案例（新增）
- [x] 撰寫 settings.ts 完整 Vitest 測試檔（27 個測試，涵蓋所有邊界條件）
- [x] 撰寫手動測試指引文件（docs/api-key-settings-test-guide.md）

## 簡單登入與單位設定（已完成）
- [x] 登入改為簡單帳號密碼（test/test），繞過 Manus OAuth
- [x] 後端加入 simpleAuth router（login mutation，test/test 進管理員，其他帳號密碼相同進一般員警）
- [x] 系統設定頁加入「單位資訊」區塊（單位名稱、員警姓名、警號），所有登入使用者可設定
- [x] 建案時自動帶入設定中的單位與姓名（unit/badgeNumber 欄位存於 users 表）
- [x] 46 個 Vitest 測試全部通過

## 移除警號欄位（已完成）
- [x] 前端 SettingsPage.tsx 移除警號輸入欄位
- [x] 後端 cases.updateProfile 的 input schema 移除 badgeNumber
- [x] 46 個 Vitest 測試全部通過

## 報案人完整欄位更新（已完成）
- [x] 資料庫 reporters 表加入：gender, birthPlace, occupation, registeredAddress, education, economicStatus
- [x] 後端 submitReporter API schema 加入所有新欄位（gender/birthDate/birthPlace/occupation/idNumber/registeredAddress/address/education/phone/economicStatus/caseType）
- [x] 前端 ReportPage 更新完整表單（11 個欄位 + 經濟狀況選擇 + 證物上傳）
- [x] 修正 TypeScript 型別錯誤（gender/education/economicStatus 使用嚴格 enum 型別）
- [x] 更新 constants.ts（EDUCATION_OPTIONS 與後端 enum 一致，新增 GenderOption/EducationOption/EconomicStatusOption 型別）
- [x] 46 個 Vitest 測試全部通過
