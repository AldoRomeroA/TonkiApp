import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export class RewardImageUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RewardImageUploadError";
  }
}

export async function saveEstablishmentRewardImage(
  file: File,
  rewardId: string
): Promise<{ url: string }> {
  const mime = (file.type || "application/octet-stream").toLowerCase();
  if (!MIME_TO_EXT[mime]) {
    throw new RewardImageUploadError(
      "Formato no permitido. Usa JPG, PNG, GIF o WebP"
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    throw new RewardImageUploadError("Imagen demasiado grande (máx. 2 MB)");
  }

  const filename = `reward-${randomUUID().slice(0, 8)}${MIME_TO_EXT[mime]}`;
  const dir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "establishment-rewards",
    rewardId
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return { url: `/uploads/establishment-rewards/${rewardId}/${filename}` };
}
