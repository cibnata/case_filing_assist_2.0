#!/bin/bash
# Surya OCR 微服務啟動腳本
# 在 Node.js 主服務啟動前先啟動此服務

export OCR_SERVICE_PORT=${OCR_SERVICE_PORT:-8765}
export APP_BASE_URL=${APP_BASE_URL:-http://localhost:3000}

echo "[Surya OCR] 啟動微服務於 port $OCR_SERVICE_PORT"
cd "$(dirname "$0")"
python3 ocr_service.py
