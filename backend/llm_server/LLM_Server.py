import time
import sys
import json
from pathlib import Path
from typing import List, Dict, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from llama_cpp import Llama

# 設定系統輸出編碼
sys.stdout.reconfigure(encoding="utf-8")

# ===============================
# 路徑與參數設定
# ===============================
MODEL_PATH = "../LLM/gemma-3-27b-it-qat-BF16.gguf"
# 確保模型存在
if not Path(MODEL_PATH).exists():
    print(f"[ERROR] 找不到模型檔案: {MODEL_PATH}")
    sys.exit(1)

# ===============================
# 初始化本地 LLM (單例模式)
# ===============================
print(f"[*] 正在載入模型: {MODEL_PATH}...")
llm = Llama(
    model_path=MODEL_PATH,
    n_ctx=40960,         
    n_batch=512,        
    n_gpu_layers=0,     
    temperature=0.1,    
    verbose=False
)

# ===============================
# FastAPI 配置
# ===============================
app = FastAPI(title="LLM Server")

# 解決跨域問題 (CORS)，讓前端 React 能夠連線
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 生產環境可限制為 ["http://localhost:5173", "http://localhost:5174"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定義請求格式
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    stream: Optional[bool] = False

# ===============================
# API Endpoints
# ===============================

@app.get("/")
async def root():
    return {"status": "online", "model": MODEL_PATH}

@app.post("/v1/chat/completions")
async def chat_completions(request: ChatRequest):
    """
    OpenAI 兼容格式的 API 端點，對接前端 callAPI
    """
    try:
        t_start = time.perf_counter()
        
        # 轉換 messages 格式
        formatted_messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        print(f"[*] 收到請求，正在生成分析結果...")
        print(formatted_messages)
        # 執行推理
        response = llm.create_chat_completion(
            messages=formatted_messages,
            temperature=0.1,
            max_tokens=2048
        )
        print(f"[*] 輸出結果...")
        print(response)
        t_end = time.perf_counter()
        print(f"[OK] 生成完成，耗時: {t_end - t_start:.2f} 秒")
        
        return response

    except Exception as e:
        print(f"[ERROR] 推理失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 啟動伺服器，監聽 8001 連接埠 (避免與 Surya 8000 衝突)
    uvicorn.run(app, host="0.0.0.0", port=8001)