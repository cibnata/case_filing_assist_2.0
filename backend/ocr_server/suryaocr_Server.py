import os
import time
import torch
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pdf2image import convert_from_path
from PIL import Image
from surya.foundation import FoundationPredictor
from surya.detection import DetectionPredictor
from surya.recognition import RecognitionPredictor
from surya.common.surya.decoder import SuryaDecoderConfig

# --- 修補與初始化 ---
original_config_init = SuryaDecoderConfig.__init__
def patched_config_init(self, *args, **kwargs):
    original_config_init(self, *args, **kwargs)
    if not hasattr(self, "pad_token_id") or self.pad_token_id is None:
        self.pad_token_id = 1
SuryaDecoderConfig.__init__ = patched_config_init

app = FastAPI()

# 允許跨域請求 (讓 React 可以呼叫)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print(f"🚀 初始化模型 (使用 {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'})...")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
foundation_predictor = FoundationPredictor(device=device, dtype=torch.bfloat16)
detection_predictor = DetectionPredictor()
recognition_predictor = RecognitionPredictor(foundation_predictor)

UPLOAD_DIR = "temp_uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/ocr")
async def do_ocr(file: UploadFile = File(...)):
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower()
    temp_path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 轉換為圖片列表
        pages = []
        if ext == ".pdf":
            pages = convert_from_path(temp_path, dpi=300, thread_count=os.cpu_count(),poppler_path=r"C:\Program Files\poppler\Library\bin")
        else:
            pages = [Image.open(temp_path).convert("RGB")]

        # 批次辨識
        start_time = time.time()
        with torch.inference_mode():
            predictions = recognition_predictor(pages, det_predictor=detection_predictor)
        
        # 彙整文字
        all_text = []
        page_results = []
        for i, pred in enumerate(predictions):
            page_text = "\n".join([line.text for line in pred.text_lines])
            all_text.append(page_text)
            page_results.append({
                "page": i + 1,
                "text": page_text
            })

        return {
            "status": "success",
            "ocr_text": "\n\n".join(all_text),
            "pages": page_results,
            "duration": round(time.time() - start_time, 2)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)