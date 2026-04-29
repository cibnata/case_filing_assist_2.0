"""
Surya OCR 微服務
使用 Surya OCR (RecognitionPredictor + DetectionPredictor) 對圖片進行文字辨識
提供 FastAPI HTTP 介面供 Node.js 後端呼叫
"""
import os
import io
import base64
import logging
import tempfile
from typing import Optional, List
from pathlib import Path

import requests
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── 設定日誌 ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Surya OCR Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 延遲載入模型（第一次請求時初始化，避免啟動時間過長）────────────────────
_recognition_predictor = None
_detection_predictor = None
_foundation_predictor = None

def get_predictors():
    global _recognition_predictor, _detection_predictor, _foundation_predictor
    if _recognition_predictor is None:
        logger.info("初始化 Surya 模型（首次載入，需要一些時間）...")
        from surya.foundation import FoundationPredictor
        from surya.recognition import RecognitionPredictor
        from surya.detection import DetectionPredictor
        _foundation_predictor = FoundationPredictor()
        _recognition_predictor = RecognitionPredictor(_foundation_predictor)
        _detection_predictor = DetectionPredictor()
        logger.info("Surya 模型載入完成")
    return _recognition_predictor, _detection_predictor


# ── 請求/回應模型 ────────────────────────────────────────────────────────────
class OcrRequest(BaseModel):
    image_url: Optional[str] = None       # 圖片 URL（優先）
    image_base64: Optional[str] = None    # Base64 圖片（備用）
    languages: Optional[List[str]] = None  # 語言提示（surya 自動偵測，此參數保留）

class OcrBatchRequest(BaseModel):
    image_urls: List[str]                 # 多張圖片 URL
    languages: Optional[List[str]] = None

class OcrResult(BaseModel):
    text: str                             # 全文（各行合併）
    lines: List[dict]                     # 各行詳細資訊
    page_count: int

class OcrBatchResult(BaseModel):
    results: List[OcrResult]
    combined_text: str                    # 所有圖片合併全文


# ── 工具函式 ─────────────────────────────────────────────────────────────────
def load_image_from_url(url: str) -> Image.Image:
    """從 URL 下載圖片並轉為 PIL Image"""
    try:
        # 支援 /uploads/ 相對路徑（透過環境變數轉換）
        if url.startswith("/uploads/") or url.startswith("/"):
            base = os.environ.get("APP_BASE_URL", "http://localhost:3000")
            url = base.rstrip("/") + url
        
        resp = requests.get(url, timeout=30, headers={"User-Agent": "SuryaOCR/1.0"})
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content)).convert("RGB")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"無法載入圖片 {url}: {str(e)}")


def load_image_from_base64(b64: str) -> Image.Image:
    """從 Base64 字串載入圖片"""
    try:
        # 移除 data:image/...;base64, 前綴
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        data = base64.b64decode(b64)
        img = Image.open(io.BytesIO(data)).convert("RGB")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"無法解析 Base64 圖片: {str(e)}")


def run_surya_ocr(images: List[Image.Image]) -> List[dict]:
    """
    對圖片列表執行 Surya OCR
    回傳每張圖片的辨識結果
    """
    recognition_predictor, detection_predictor = get_predictors()
    
    try:
        predictions = recognition_predictor(images, det_predictor=detection_predictor)
        results = []
        for pred in predictions:
            lines = []
            full_text_parts = []
            
            for line in pred.text_lines:
                line_text = line.text.strip()
                if line_text:
                    lines.append({
                        "text": line_text,
                        "confidence": round(float(line.confidence), 4) if hasattr(line, 'confidence') else 0.0,
                        "bbox": list(line.bbox) if hasattr(line, 'bbox') else [],
                    })
                    full_text_parts.append(line_text)
            
            full_text = "\n".join(full_text_parts)
            results.append({
                "text": full_text,
                "lines": lines,
            })
        
        return results
    except Exception as e:
        logger.error(f"Surya OCR 執行失敗: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 處理失敗: {str(e)}")


# ── API 端點 ─────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "surya-ocr"}


@app.post("/ocr/single", response_model=OcrResult)
def ocr_single(req: OcrRequest):
    """對單張圖片進行 OCR"""
    if req.image_url:
        img = load_image_from_url(req.image_url)
    elif req.image_base64:
        img = load_image_from_base64(req.image_base64)
    else:
        raise HTTPException(status_code=400, detail="必須提供 image_url 或 image_base64")
    
    results = run_surya_ocr([img])
    r = results[0]
    return OcrResult(
        text=r["text"],
        lines=r["lines"],
        page_count=1,
    )


@app.post("/ocr/batch", response_model=OcrBatchResult)
def ocr_batch(req: OcrBatchRequest):
    """對多張圖片批次 OCR"""
    if not req.image_urls:
        raise HTTPException(status_code=400, detail="image_urls 不可為空")
    
    images = [load_image_from_url(url) for url in req.image_urls]
    results = run_surya_ocr(images)
    
    ocr_results = []
    all_texts = []
    for i, r in enumerate(results):
        ocr_results.append(OcrResult(
            text=r["text"],
            lines=r["lines"],
            page_count=1,
        ))
        if r["text"].strip():
            all_texts.append(f"=== 圖片 {i+1} ===\n{r['text']}")
    
    combined_text = "\n\n".join(all_texts)
    return OcrBatchResult(results=ocr_results, combined_text=combined_text)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("OCR_SERVICE_PORT", "18765"))
    logger.info(f"Surya OCR 微服務啟動於 port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
