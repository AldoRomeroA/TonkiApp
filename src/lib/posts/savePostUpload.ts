import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { maxPostUploadBytesForMime } from "src/lib/posts/constants";

/** @deprecated Usar `maxPostUploadBytesForMime` desde constants. */
export const DEFAULT_POST_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? "";
}

function sanitizeBaseName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "file";
}

const ALLOWED_POST_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export function isAllowedPostUploadMime(mime: string): boolean {
  return ALLOWED_POST_MIMES.has(mime.toLowerCase());
}

function bufferLooksLikeIsoBmff(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  return buf.subarray(4, 8).toString("ascii") === "ftyp";
}

function bufferLooksLikeWebm(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

function bufferMatchesDeclaredMime(buf: Buffer, mime: string): boolean {
  if (mime === "video/webm") return bufferLooksLikeWebm(buf);
  if (buf.length < 12) return false;
  switch (mime) {
    case "image/jpeg":
      return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    case "image/png":
      return (
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );
    case "image/gif": {
      const sig = buf.subarray(0, 6).toString("ascii");
      return sig === "GIF87a" || sig === "GIF89a";
    }
    case "image/webp":
      if (buf.subarray(0, 4).toString("ascii") !== "RIFF") return false;
      return buf.subarray(8, 12).toString("ascii") === "WEBP";
    case "application/pdf":
      return buf.subarray(0, 5).toString("latin1") === "%PDF-";
    case "video/mp4":
    case "video/quicktime":
      return bufferLooksLikeIsoBmff(buf);
    default:
      return false;
  }
}

export class PostUploadError extends Error {
  constructor(
    message: string,
    public readonly code: "TOO_LARGE" | "INVALID_TYPE",
    public readonly mime?: string
  ) {
    super(message);
    this.name = "PostUploadError";
  }
}

export type SavedPostFile = {
  url: string;
  mime_type: string;
  original_name: string | null;
};

export type SavePostUploadOptions = {
  maxBytes?: number;
  /** Índice en el multipart para nombres de archivo estables por orden */
  index?: number;
};

/**
 * Guarda un adjunto en `public/uploads/posts/{postId}/` tras validar tipo y tamaño.
 */
export async function savePostUpload(
  file: File,
  postId: string,
  options?: SavePostUploadOptions
): Promise<SavedPostFile> {
  const mime = (file.type || "application/octet-stream").toLowerCase();
  const maxBytes =
    options?.maxBytes ?? maxPostUploadBytesForMime(mime);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > maxBytes) {
    throw new PostUploadError("Archivo demasiado grande", "TOO_LARGE");
  }
  if (!isAllowedPostUploadMime(mime)) {
    throw new PostUploadError("Tipo de archivo no permitido", "INVALID_TYPE", mime);
  }
  if (!bufferMatchesDeclaredMime(buf, mime)) {
    throw new PostUploadError(
      "El contenido no coincide con el tipo declarado",
      "INVALID_TYPE",
      mime
    );
  }
  let ext = path.extname(file.name || "");
  if (!ext) {
    ext = extensionForMime(mime);
  }
  const rawBase =
    sanitizeBaseName(path.basename(file.name || "attachment", ext)) || "file";
  const shortId = randomUUID().slice(0, 8);
  const prefix =
    typeof options?.index === "number" ? `${options.index}-` : "";
  const filename = `${prefix}${rawBase}-${shortId}${ext || ""}`;
  const root = path.join(process.cwd(), "public", "uploads", "posts");
  const dir = path.join(root, postId);
  await mkdir(dir, { recursive: true });
  const fsPath = path.join(dir, filename);
  await writeFile(fsPath, buf);
  const url = `/uploads/posts/${postId}/${filename}`;
  const original_name =
    file.name && file.name.length > 0 ? file.name.slice(0, 255) : null;
  return { url, mime_type: mime, original_name };
}
