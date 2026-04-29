import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

const UPLOAD_PUBLIC_PATH = "/uploads";

export function getStorageRoot(): string {
  return path.resolve(process.cwd(), ENV.localStorageDir);
}

export function normalizeStorageKey(relKey: string): string {
  const key = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = key.split("/");

  if (!key || key.includes("\0") || parts.some(part => part === ".." || part === ".")) {
    throw new Error("Invalid storage key");
  }

  return key;
}

export function resolveStoragePath(relKey: string): { key: string; filePath: string } {
  const key = normalizeStorageKey(relKey);
  const root = getStorageRoot();
  const filePath = path.resolve(root, key);
  const relative = path.relative(root, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Storage key escapes upload directory");
  }

  return { key, filePath };
}

function toPublicUrl(key: string): string {
  return `${UPLOAD_PUBLIC_PATH}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  void contentType;

  const key = appendHashSuffix(normalizeStorageKey(relKey));
  const { filePath } = resolveStoragePath(key);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);

  return { key, url: toPublicUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeStorageKey(relKey);
  return { key, url: toPublicUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { url } = await storageGet(relKey);
  return url;
}
