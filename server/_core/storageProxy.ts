import type { Express } from "express";
import { resolveStoragePath } from "../storage";

export function registerStorageProxy(app: Express) {
  app.get("/uploads/*", (req: any, res) => {
    const key = req.params[0] as string | undefined;
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    let filePath: string;
    try {
      filePath = resolveStoragePath(key).filePath;
    } catch {
      res.status(400).send("Invalid storage key");
      return;
    }

    res.set("Cache-Control", "no-store");
    res.sendFile(filePath, err => {
      if (!err || res.headersSent) return;
      const status = (err as NodeJS.ErrnoException & { statusCode?: number }).statusCode;
      res.status(status === 404 ? 404 : 500).send(status === 404 ? "File not found" : "Storage error");
    });
  });
}
