/**
 * Surya OCR 微服務管理器
 * 在 Node.js 主服務啟動時自動啟動 Python FastAPI 微服務
 * 並在主服務關閉時一併終止
 */
import { spawn, ChildProcess } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let suryaProcess: ChildProcess | null = null;

const SURYA_PORT = parseInt(process.env.SURYA_SERVICE_PORT || "8765");
const SURYA_SCRIPT = path.resolve(__dirname, "../surya-service/ocr_service.py");

/**
 * 等待 Surya 服務就緒（最多等 60 秒）
 */
async function waitForSuryaReady(maxWaitMs = 60_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const resp = await fetch(`http://localhost:${SURYA_PORT}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) return true;
    } catch {
      // 尚未就緒
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

/**
 * 啟動 Surya OCR 微服務
 */
export async function startSuryaService(): Promise<void> {
  // 先檢查是否已在運行
  try {
    const resp = await fetch(`http://localhost:${SURYA_PORT}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    if (resp.ok) {
      console.log(`[Surya OCR] 微服務已在 port ${SURYA_PORT} 運行`);
      return;
    }
  } catch {
    // 未運行，繼續啟動
  }

  console.log(`[Surya OCR] 啟動微服務（port ${SURYA_PORT}）...`);

  const env = {
    ...process.env,
    OCR_SERVICE_PORT: String(SURYA_PORT),
    APP_BASE_URL: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  };

  suryaProcess = spawn("python3", [SURYA_SCRIPT], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  suryaProcess.stdout?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[Surya OCR] ${msg}`);
  });

  suryaProcess.stderr?.on("data", (data: Buffer) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes("INFO:")) {
      console.warn(`[Surya OCR] ${msg}`);
    }
  });

  suryaProcess.on("exit", (code) => {
    console.log(`[Surya OCR] 微服務已退出（code: ${code}）`);
    suryaProcess = null;
  });

  suryaProcess.on("error", (err) => {
    console.error(`[Surya OCR] 啟動失敗:`, err.message);
    suryaProcess = null;
  });

  // 等待服務就緒
  const ready = await waitForSuryaReady(90_000);
  if (ready) {
    console.log(`[Surya OCR] 微服務已就緒（port ${SURYA_PORT}）`);
  } else {
    console.warn(`[Surya OCR] 微服務啟動超時，OCR 將使用 VLM fallback`);
  }
}

/**
 * 停止 Surya OCR 微服務
 */
export function stopSuryaService(): void {
  if (suryaProcess) {
    console.log("[Surya OCR] 正在停止微服務...");
    suryaProcess.kill("SIGTERM");
    suryaProcess = null;
  }
}

// 確保主程序退出時清理子程序
process.on("exit", stopSuryaService);
process.on("SIGINT", () => { stopSuryaService(); process.exit(0); });
process.on("SIGTERM", () => { stopSuryaService(); process.exit(0); });
