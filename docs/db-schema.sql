-- ============================================================
-- 受理報案輔助系統 — PostgreSQL Schema
-- Version: 1.0 (MVP)
-- ============================================================

-- 啟用必要擴充
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 使用者與權限
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'officer',          -- 值班員警
    'supervisor',       -- 主管（覆核）
    'forensic',         -- 鑑識支援
    'admin'             -- 系統管理員
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    badge_number    VARCHAR(20) UNIQUE NOT NULL,     -- 警員編號
    name            VARCHAR(100) NOT NULL,
    unit            VARCHAR(200) NOT NULL,            -- 單位（XX派出所/偵查隊/刑大）
    role            user_role NOT NULL DEFAULT 'officer',
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_unit ON users(unit);
CREATE INDEX idx_users_badge ON users(badge_number);

-- ============================================================
-- 2. 案件管理
-- ============================================================

CREATE TYPE case_status AS ENUM (
    'draft',            -- 草稿（建立中）
    'processing',       -- 處理中（OCR/抽取中）
    'pending_review',   -- 待校對確認
    'confirmed',        -- 已確認
    'exported',         -- 已匯出
    'transferred',      -- 已移送上級
    'closed'            -- 結案
);

CREATE TYPE case_type AS ENUM (
    'fraud',            -- 詐欺
    'money_laundering', -- 洗錢
    'theft',            -- 竊盜
    'cybercrime',       -- 網路犯罪
    'other'             -- 其他
);

CREATE TABLE cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number     VARCHAR(50) UNIQUE NOT NULL,       -- 報案序號
    report_number   VARCHAR(50),                        -- 報案三聯單號碼
    case_type       case_type NOT NULL DEFAULT 'fraud',
    status          case_status NOT NULL DEFAULT 'draft',
    title           VARCHAR(500),                       -- 案件摘要標題
    description     TEXT,                               -- 案件描述
    reporter_name   VARCHAR(100),                       -- 報案人姓名
    reporter_id     VARCHAR(20),                        -- 報案人身分證字號（加密儲存）
    reporter_phone  VARCHAR(30),                        -- 報案人電話
    officer_id      UUID REFERENCES users(id),          -- 受理員警
    unit            VARCHAR(200),                        -- 受理單位
    reported_at     TIMESTAMPTZ,                        -- 報案時間
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_officer ON cases(officer_id);
CREATE INDEX idx_cases_unit ON cases(unit);
CREATE INDEX idx_cases_created ON cases(created_at DESC);
CREATE INDEX idx_cases_number ON cases(case_number);

-- ============================================================
-- 3. 證據管理
-- ============================================================

CREATE TYPE evidence_type AS ENUM (
    'screenshot',        -- 手機截圖
    'bank_transfer',     -- 網銀轉帳畫面
    'chat_record',       -- 聊天對話紀錄
    'transaction_detail',-- 交易明細
    'qr_code',           -- QR Code
    'pdf_document',      -- PDF 文件
    'photo',             -- 照片
    'other'              -- 其他
);

CREATE TYPE evidence_status AS ENUM (
    'uploaded',          -- 已上傳
    'preprocessing',     -- 預處理中
    'ocr_processing',    -- OCR 處理中
    'ocr_completed',     -- OCR 完成
    'extracting',        -- 情資抽取中
    'extracted',         -- 抽取完成
    'confirmed',         -- 已確認
    'failed'             -- 處理失敗
);

CREATE TABLE evidence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_number VARCHAR(20) NOT NULL,               -- 證物編號（案件內流水號）
    evidence_type   evidence_type NOT NULL,
    status          evidence_status NOT NULL DEFAULT 'uploaded',
    original_filename VARCHAR(500),                      -- 原始檔名
    file_path       VARCHAR(1000) NOT NULL,              -- 物件儲存路徑
    file_hash       VARCHAR(128) NOT NULL,               -- SHA-256 雜湊（完整性驗證）
    file_size       BIGINT,                              -- 檔案大小（bytes）
    mime_type       VARCHAR(100),
    thumbnail_path  VARCHAR(1000),                       -- 縮圖路徑
    metadata        JSONB DEFAULT '{}',                  -- 額外中繼資料（EXIF 等）
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evidence_case ON evidence(case_id);
CREATE INDEX idx_evidence_status ON evidence(status);
CREATE INDEX idx_evidence_hash ON evidence(file_hash);

-- ============================================================
-- 4. OCR 結果
-- ============================================================

CREATE TABLE ocr_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_id     UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    engine          VARCHAR(50) NOT NULL DEFAULT 'paddleocr', -- 使用的 OCR 引擎
    engine_version  VARCHAR(20),
    full_text       TEXT,                                -- 完整辨識文字
    confidence_avg  DECIMAL(5,4),                        -- 平均信心分數
    processing_time_ms INTEGER,                          -- 處理耗時（毫秒）
    page_number     INTEGER DEFAULT 1,                   -- 頁碼（PDF 用）
    raw_result      JSONB,                               -- 原始引擎輸出（含座標）
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ocr_evidence ON ocr_results(evidence_id);

-- OCR 文字區塊（含定位框座標）
CREATE TABLE ocr_text_blocks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ocr_result_id   UUID NOT NULL REFERENCES ocr_results(id) ON DELETE CASCADE,
    text            TEXT NOT NULL,
    confidence      DECIMAL(5,4),                        -- 該區塊信心分數
    bbox_x          INTEGER,                             -- 定位框左上角 X
    bbox_y          INTEGER,                             -- 定位框左上角 Y
    bbox_width      INTEGER,                             -- 定位框寬度
    bbox_height     INTEGER,                             -- 定位框高度
    block_order     INTEGER,                             -- 排序（由上而下、由左而右）
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_textblocks_ocr ON ocr_text_blocks(ocr_result_id);

-- ============================================================
-- 5. 情資擷取結果（ExtractedField）
-- ============================================================

CREATE TYPE field_type AS ENUM (
    'wallet_address',     -- 加密貨幣錢包地址
    'tx_hash',            -- 交易雜湊
    'bank_account',       -- 銀行帳號
    'url',                -- 網址
    'phone_number',       -- 電話號碼
    'datetime',           -- 日期時間
    'amount',             -- 金額
    'person_name',        -- 人名
    'email',              -- 電子郵件
    'ip_address',         -- IP 位址
    'device_id',          -- 裝置識別碼
    'exchange_account',   -- 交易所帳號
    'line_id',            -- LINE ID
    'other'               -- 其他
);

CREATE TYPE validation_status AS ENUM (
    'valid',              -- 驗證通過
    'invalid',            -- 驗證失敗
    'warning',            -- 警告（格式正確但有疑慮）
    'unchecked',          -- 未驗證
    'not_applicable'      -- 不適用驗證
);

CREATE TYPE confirmation_status AS ENUM (
    'pending',            -- 待確認
    'confirmed',          -- 已確認
    'rejected',           -- 已駁回
    'modified'            -- 已修改確認
);

CREATE TABLE extracted_fields (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id             UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    evidence_id         UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    ocr_text_block_id   UUID REFERENCES ocr_text_blocks(id),   -- 對應的 OCR 文字區塊
    field_type          field_type NOT NULL,
    extracted_value     TEXT NOT NULL,                           -- AI/規則抽取的值
    confidence          DECIMAL(5,4),                            -- 信心分數 0~1
    extraction_method   VARCHAR(50),                             -- 'regex' / 'llm' / 'qrcode' / 'manual'
    -- 驗證相關
    validation_status   validation_status DEFAULT 'unchecked',
    validation_detail   TEXT,                                    -- 驗證細節（如 checksum 結果）
    validator_version   VARCHAR(20),
    -- 來源定位
    bbox_x              INTEGER,
    bbox_y              INTEGER,
    bbox_width          INTEGER,
    bbox_height         INTEGER,
    -- 額外屬性（依 field_type 不同）
    attributes          JSONB DEFAULT '{}',
    -- chain: 'ETH'/'BTC'/'TRON'
    -- currency: 'TWD'/'USDT'
    -- bank_code: '004'
    -- url_risk: 'phishing'/'shortened'/'normal'
    -- datetime_parsed: ISO8601 標準格式
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extracted_case ON extracted_fields(case_id);
CREATE INDEX idx_extracted_evidence ON extracted_fields(evidence_id);
CREATE INDEX idx_extracted_type ON extracted_fields(field_type);
CREATE INDEX idx_extracted_value ON extracted_fields(extracted_value);
CREATE INDEX idx_extracted_validation ON extracted_fields(validation_status);

-- 候選值（多候選機制：Top-N）
CREATE TABLE field_candidates (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extracted_field_id  UUID NOT NULL REFERENCES extracted_fields(id) ON DELETE CASCADE,
    candidate_value     TEXT NOT NULL,
    confidence          DECIMAL(5,4),
    rank                INTEGER NOT NULL,                        -- 排名 1=最佳
    validation_status   validation_status DEFAULT 'unchecked',
    validation_detail   TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_candidates_field ON field_candidates(extracted_field_id);

-- ============================================================
-- 6. 人工確認紀錄（FieldConfirmation）
-- ============================================================

CREATE TABLE field_confirmations (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    extracted_field_id  UUID NOT NULL REFERENCES extracted_fields(id),
    confirmation_status confirmation_status NOT NULL,
    confirmed_value     TEXT,                                     -- 最終確認值（可能與抽取值不同）
    original_value      TEXT,                                     -- 修改前的值（若有修改）
    confirmed_by        UUID NOT NULL REFERENCES users(id),       -- 確認人
    confirmed_at        TIMESTAMPTZ DEFAULT NOW(),
    reason              TEXT,                                      -- 修改理由/備註
    version             INTEGER NOT NULL DEFAULT 1                 -- 版本號
);

CREATE INDEX idx_confirmations_field ON field_confirmations(extracted_field_id);
CREATE INDEX idx_confirmations_user ON field_confirmations(confirmed_by);

-- ============================================================
-- 7. 匯出紀錄（ExportPackage）
-- ============================================================

CREATE TYPE export_format AS ENUM (
    'clipboard',         -- 一鍵複製（純文字格式）
    'word',              -- Word 文件
    'pdf',               -- PDF
    'csv',               -- CSV
    'json',              -- JSON（系統間傳輸）
    'package'            -- 完整打包（含原始證據）
);

CREATE TABLE export_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID NOT NULL REFERENCES cases(id),
    export_format   export_format NOT NULL,
    file_path       VARCHAR(1000),                       -- 匯出檔案路徑
    file_hash       VARCHAR(128),                        -- 匯出檔案雜湊
    watermark       VARCHAR(100),                        -- 浮水印/編號
    includes_evidence BOOLEAN DEFAULT FALSE,             -- 是否包含原始證據
    includes_ocr    BOOLEAN DEFAULT TRUE,
    includes_audit  BOOLEAN DEFAULT FALSE,               -- 是否包含稽核紀錄
    exported_by     UUID NOT NULL REFERENCES users(id),
    exported_at     TIMESTAMPTZ DEFAULT NOW(),
    metadata        JSONB DEFAULT '{}'
);

CREATE INDEX idx_exports_case ON export_records(case_id);

-- ============================================================
-- 8. 稽核日誌（Audit Log）
-- ============================================================

CREATE TYPE audit_action AS ENUM (
    'case_create',       'case_update',       'case_delete',
    'evidence_upload',   'evidence_delete',
    'ocr_start',         'ocr_complete',      'ocr_fail',
    'extract_start',     'extract_complete',
    'field_confirm',     'field_modify',      'field_reject',
    'export_generate',   'export_download',
    'case_transfer',     -- 移送上級
    'user_login',        'user_logout',
    'view_case',         'view_evidence',     -- 查閱紀錄
    'supervisor_review'  -- 主管覆核
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
    action          audit_action NOT NULL,
    case_id         UUID REFERENCES cases(id),
    evidence_id     UUID REFERENCES evidence(id),
    field_id        UUID REFERENCES extracted_fields(id),
    detail          JSONB DEFAULT '{}',                  -- 變更前後值、額外細節
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 稽核日誌不可刪改，只做 INSERT
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_case ON audit_logs(case_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ============================================================
-- 9. 驗證規則版本管理
-- ============================================================

CREATE TABLE validator_rules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    field_type      field_type NOT NULL,
    rule_name       VARCHAR(200) NOT NULL,
    rule_type       VARCHAR(50) NOT NULL,                -- 'regex' / 'checksum' / 'llm_prompt'
    rule_definition TEXT NOT NULL,                        -- 正則表達式 / 檢查邏輯描述
    chain           VARCHAR(20),                         -- 適用鏈別（加密貨幣用）
    version         INTEGER NOT NULL DEFAULT 1,
    is_active       BOOLEAN DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rules_type ON validator_rules(field_type);
CREATE INDEX idx_rules_active ON validator_rules(is_active);

-- ============================================================
-- 10. 案件移送紀錄
-- ============================================================

CREATE TABLE case_transfers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID NOT NULL REFERENCES cases(id),
    from_unit       VARCHAR(200) NOT NULL,
    to_unit         VARCHAR(200) NOT NULL,
    transfer_type   VARCHAR(50),                         -- 'investigation' / 'prosecution'
    package_path    VARCHAR(1000),                        -- 移送包檔案路徑
    notes           TEXT,
    transferred_by  UUID NOT NULL REFERENCES users(id),
    transferred_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfers_case ON case_transfers(case_id);

-- ============================================================
-- 檢視（View）— 常用查詢
-- ============================================================

-- 案件總覽（含統計）
CREATE VIEW v_case_overview AS
SELECT
    c.id,
    c.case_number,
    c.case_type,
    c.status,
    c.title,
    c.unit,
    c.reported_at,
    c.created_at,
    u.name AS officer_name,
    u.badge_number,
    COUNT(DISTINCT e.id) AS evidence_count,
    COUNT(DISTINCT ef.id) AS field_count,
    COUNT(DISTINCT ef.id) FILTER (WHERE fc.confirmation_status = 'confirmed') AS confirmed_count,
    COUNT(DISTINCT ef.id) FILTER (WHERE ef.validation_status = 'invalid') AS invalid_count
FROM cases c
LEFT JOIN users u ON c.officer_id = u.id
LEFT JOIN evidence e ON e.case_id = c.id
LEFT JOIN extracted_fields ef ON ef.case_id = c.id
LEFT JOIN field_confirmations fc ON fc.extracted_field_id = ef.id
GROUP BY c.id, u.name, u.badge_number;

-- 待確認欄位清單
CREATE VIEW v_pending_fields AS
SELECT
    ef.*,
    c.case_number,
    e.original_filename,
    e.evidence_type
FROM extracted_fields ef
JOIN cases c ON ef.case_id = c.id
JOIN evidence e ON ef.evidence_id = e.id
WHERE NOT EXISTS (
    SELECT 1 FROM field_confirmations fc
    WHERE fc.extracted_field_id = ef.id
    AND fc.confirmation_status IN ('confirmed', 'modified')
);
