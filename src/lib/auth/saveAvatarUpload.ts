import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const ALLOWED_AVATAR_MIMES = new Set(Object.keys(MIME_TO_EXT));

export class AvatarUploadError extends Error {
  constructor(
    message: string,
    public readonly code: "TOO_LARGE" | "INVALID_TYPE"
  ) {
    super(message);
    this.name = "AvatarUploadError";
  }
}

function bufferMatchesDeclaredMime(buf: Buffer, mime: string): boolean {
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
    default:
      return false;
  }
}

/**
 * Guarda el avatar en `public/uploads/avatars/{userId}/` tras validar tipo y tamaño.
 */
export async function saveAvatarUpload(
  file: File,
  userId: string
): Promise<{ url: string }> {
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (Number.isFinite(file.size) && file.size > AVATAR_MAX_BYTES) {
    throw new AvatarUploadError("Imagen demasiado grande (máx. 2 MB)", "TOO_LARGE");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > AVATAR_MAX_BYTES) {
    throw new AvatarUploadError("Imagen demasiado grande (máx. 2 MB)", "TOO_LARGE");
  }
  if (!ALLOWED_AVATAR_MIMES.has(mime)) {
    throw new AvatarUploadError(
      "Formato no permitido. Usa JPG, PNG, GIF o WebP",
      "INVALID_TYPE"
    );
  }
  if (!bufferMatchesDeclaredMime(buf, mime)) {
    throw new AvatarUploadError(
      "El contenido no coincide con el tipo de imagen",
      "INVALID_TYPE"
    );
  }

  const ext = MIME_TO_EXT[mime] ?? ".jpg";
  const filename = `avatar-${randomUUID().slice(0, 8)}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "avatars", userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return { url: `/uploads/avatars/${userId}/${filename}` };
}
