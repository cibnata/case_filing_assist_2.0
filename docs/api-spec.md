# 受理報案輔助系統 — API 規格書 v1.0

## 基本設定

- Base URL: `https://internal.police.gov.tw/api/v1`
- 認證方式: JWT Token (透過 `/auth/login` 取得)
- Content-Type: `application/json` (除檔案上傳外)
- 所有時間欄位使用 ISO 8601 格式 (台灣時區 UTC+8)

---

## 1. 認證與權限 `/auth`

### POST `/auth/login`
員警登入，取得 JWT Token。

**Request:**
```json
{
  "badge_number": "A12345",
  "password": "..."
}
```

**Response (200):**
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "name": "王大明",
    "unit": "中正一分局忠孝東路派出所",
    "role": "officer"
  },
  "expires_at": "2026-03-05T22:00:00+08:00"
}
```

---

## 2. 案件管理 `/cases`

### GET `/cases`
取得案件列表（依權限過濾）。

**Query Parameters:**
| 參數 | 型別 | 說明 |
|------|------|------|
| status | string | 篩選狀態 (draft/processing/pending_review/confirmed/exported) |
| unit | string | 篩選單位 |
| page | int | 頁碼 (default: 1) |
| per_page | int | 每頁筆數 (default: 20) |
| q | string | 關鍵字搜尋 (案號/標題/報案人) |

### POST `/cases`
建立新案件。

**Request:**
```json
{
  "case_number": "NPA-2026-001234",
  "case_type": "fraud",
  "title": "加密貨幣投資詐欺案",
  "description": "...",
  "reporter_name": "王○○",
  "reporter_id_encrypted": "加密後的身分證字號",
  "reporter_phone": "09xx-xxx-xxx"
}
```

### GET `/cases/:id`
取得單一案件詳情（含統計）。

### PATCH `/cases/:id`
更新案件資訊。

### POST `/cases/:id/transfer`
移送案件至上級單位。

**Request:**
```json
{
  "to_unit": "中正一分局偵查隊",
  "notes": "移送偵辦",
  "include_evidence": true,
  "include_audit_log": true
}
```

---

## 3. 證據管理 `/evidence`

### POST `/evidence/upload`
上傳證據檔案（multipart/form-data）。

**Form Fields:**
| 欄位 | 型別 | 說明 |
|------|------|------|
| case_id | uuid | 案件 ID |
| file | binary | 證據檔案 (image/pdf) |
| evidence_type | string | screenshot/bank_transfer/chat_record/... |
| description | string | 證據描述（選填） |

**Response (201):**
```json
{
  "id": "uuid",
  "evidence_number": "E-001",
  "status": "uploaded",
  "file_hash": "sha256:abcdef...",
  "thumbnail_url": "/api/v1/evidence/uuid/thumbnail"
}
```

### GET `/evidence/:id`
取得證據詳情。

### GET `/evidence/:id/image`
取得原始影像。

### GET `/evidence/:id/thumbnail`
取得縮圖。

### GET `/evidence/:id/highlight`
取得帶有欄位定位框標註的影像。

**Query Parameters:**
| 參數 | 型別 | 說明 |
|------|------|------|
| field_id | uuid | 特定欄位 ID（高亮該欄位） |
| show_all | bool | 顯示所有欄位定位框 |

---

## 4. OCR 任務 `/ocr`

### POST `/ocr/submit`
提交 OCR 任務。

**Request:**
```json
{
  "evidence_id": "uuid",
  "engine": "paddleocr",
  "options": {
    "language": "zh-tw",
    "preprocess": true,
    "detect_qrcode": true
  }
}
```

**Response (202):**
```json
{
  "task_id": "uuid",
  "status": "queued",
  "estimated_time_seconds": 15
}
```

### GET `/ocr/status/:task_id`
查詢 OCR 任務狀態。

### GET `/ocr/results/:evidence_id`
取得 OCR 結果。

**Response (200):**
```json
{
  "id": "uuid",
  "evidence_id": "uuid",
  "engine": "paddleocr",
  "full_text": "完整辨識文字...",
  "confidence_avg": 0.92,
  "processing_time_ms": 3200,
  "text_blocks": [
    {
      "id": "uuid",
      "text": "0x1234abcd...",
      "confidence": 0.97,
      "bbox": { "x": 120, "y": 340, "width": 450, "height": 28 },
      "block_order": 5
    }
  ],
  "qr_codes": [
    { "data": "ethereum:0x1234...", "bbox": { "x": 50, "y": 50, "width": 200, "height": 200 } }
  ]
}
```

---

## 5. 情資抽取 `/extract`

### POST `/extract/submit`
提交情資抽取任務。

**Request:**
```json
{
  "evidence_id": "uuid",
  "ocr_result_id": "uuid",
  "extractors": ["regex", "llm", "qrcode"],
  "field_types": ["wallet_address", "tx_hash", "bank_account", "url", "datetime", "amount"]
}
```

### GET `/extract/results/:evidence_id`
取得擷取結果。

**Response (200):**
```json
{
  "fields": [
    {
      "id": "uuid",
      "field_type": "wallet_address",
      "extracted_value": "0x1234abcdef...",
      "confidence": 0.95,
      "extraction_method": "regex+llm",
      "validation": {
        "status": "valid",
        "detail": "ETH 地址格式正確 (42字元, EIP-55 Checksum 通過)"
      },
      "source": {
        "evidence_id": "uuid",
        "text_block_id": "uuid",
        "bbox": { "x": 120, "y": 340, "width": 450, "height": 28 }
      },
      "candidates": [
        { "rank": 1, "value": "0x1234abcdef...", "confidence": 0.95 },
        { "rank": 2, "value": "0x1234abcdeF...", "confidence": 0.72 }
      ],
      "attributes": {
        "chain": "ETH",
        "address_type": "EOA"
      }
    }
  ]
}
```

---

## 6. 欄位確認 `/fields`

### POST `/fields/:id/confirm`
確認欄位值。

**Request:**
```json
{
  "confirmed_value": "0x1234abcdef...",
  "reason": "與原圖核對一致"
}
```

### POST `/fields/:id/reject`
駁回欄位。

**Request:**
```json
{
  "reason": "地址模糊無法辨識"
}
```

### PATCH `/fields/:id`
修改欄位值（自動觸發重新驗證）。

**Request:**
```json
{
  "value": "0x1234abcdef...",
  "reason": "手動修正第 38 字元"
}
```

---

## 7. 匯出 `/export`

### POST `/export/generate`
產生匯出檔案。

**Request:**
```json
{
  "case_id": "uuid",
  "format": "clipboard|csv|word|pdf|json|package",
  "include_evidence": false,
  "include_audit": false,
  "watermark": true,
  "fields_filter": "confirmed_only"
}
```

**Response (200, format=clipboard):**
```json
{
  "content": "格式化的純文字內容...",
  "export_id": "uuid"
}
```

**Response (200, format=csv/word/pdf/package):**
```json
{
  "download_url": "/api/v1/export/download/uuid",
  "file_hash": "sha256:...",
  "watermark_id": "WM-20260305-001",
  "export_id": "uuid"
}
```

### GET `/export/download/:export_id`
下載匯出檔案。

---

## 8. 稽核日誌 `/audit`

### GET `/audit/logs`
查詢稽核日誌。

**Query Parameters:**
| 參數 | 型別 | 說明 |
|------|------|------|
| case_id | uuid | 篩選案件 |
| user_id | uuid | 篩選操作人 |
| action | string | 篩選動作類型 |
| from | datetime | 起始時間 |
| to | datetime | 結束時間 |
| page | int | 頁碼 |

**Response (200):**
```json
{
  "logs": [
    {
      "id": "uuid",
      "user": { "id": "uuid", "name": "王大明", "badge_number": "A12345" },
      "action": "field_confirm",
      "case_id": "uuid",
      "detail": { "field_id": "uuid", "before": null, "after": "0x1234..." },
      "ip_address": "10.0.1.50",
      "created_at": "2026-03-05T14:30:00+08:00"
    }
  ],
  "total": 128,
  "page": 1
}
```

---

## 9. 驗證規則 `/validators`

### GET `/validators/rules`
取得目前啟用的驗證規則清單。

### POST `/validators/check`
手動觸發單一值的驗證。

**Request:**
```json
{
  "field_type": "wallet_address",
  "value": "0x1234abcdef...",
  "attributes": { "chain": "ETH" }
}
```

**Response (200):**
```json
{
  "status": "valid",
  "detail": "ETH 地址格式正確 (42字元, EIP-55 Checksum 通過)",
  "checks": [
    { "rule": "length_check", "passed": true, "detail": "42 chars" },
    { "rule": "hex_check", "passed": true, "detail": "Valid hex after 0x" },
    { "rule": "eip55_checksum", "passed": true, "detail": "Checksum valid" }
  ]
}
```

---

## 錯誤格式

所有錯誤回傳統一格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "地址格式不正確",
    "details": [
      { "field": "value", "message": "ETH 地址應為 42 字元" }
    ]
  }
}
```

## HTTP 狀態碼

| 狀態碼 | 說明 |
|--------|------|
| 200 | 成功 |
| 201 | 建立成功 |
| 202 | 任務已接受（非同步） |
| 400 | 請求格式錯誤 |
| 401 | 未認證 |
| 403 | 權限不足 |
| 404 | 資源不存在 |
| 422 | 驗證失敗 |
| 500 | 伺服器錯誤 |
