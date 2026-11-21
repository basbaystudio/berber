import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/**
 * Dosya depolama soyutlaması. Veritabanına görselin kendisi değil, anahtar + URL yazılır.
 * - Canlı: Vercel Blob (BLOB_READ_WRITE_TOKEN tanımlıysa)
 * - Yerel geliştirme/test: .uploads klasörü, /media/... üzerinden sunulur
 */
export type StoredFile = { key: string; url: string };

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<StoredFile>;
  get(file: StoredFile): Promise<Buffer>;
  delete(file: StoredFile): Promise<void>;
}

export const LOCAL_ROOT = path.resolve(process.cwd(), ".uploads");

const localStorage: Storage = {
  async put(key, body) {
    const target = path.resolve(LOCAL_ROOT, key);
    if (!target.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Geçersiz dosya yolu");
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body);
    return { key, url: `/media/${key}` };
  },
  async get(file) {
    const target = path.resolve(LOCAL_ROOT, file.key);
    if (!target.startsWith(LOCAL_ROOT + path.sep)) throw new Error("Geçersiz dosya yolu");
    return fs.readFile(target);
  },
  async delete(file) {
    const target = path.resolve(LOCAL_ROOT, file.key);
    if (!target.startsWith(LOCAL_ROOT + path.sep)) return;
    await fs.rm(target, { force: true });
  },
};

const blobStorage: Storage = {
  async put(key, body, contentType) {
    const res = await put(key, body, { access: "public", contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
    return { key, url: res.url };
  },
  async get(file) {
    const res = await fetch(file.url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Dosya okunamadı: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  },
  async delete(file) {
    await del(file.url);
  },
};

export function getStorage(): Storage {
  return process.env.BLOB_READ_WRITE_TOKEN ? blobStorage : localStorage;
}

export const isLocalStorage = () => !process.env.BLOB_READ_WRITE_TOKEN;
