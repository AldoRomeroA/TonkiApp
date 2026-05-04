/** Máximo de adjuntos por publicación (cliente y servidor). */
export const POST_MAX_ATTACHMENTS = 4;

/** Imágenes y PDF (debe coincidir con `savePostUpload` para esos MIME). */
export const POST_UPLOAD_MAX_BYTES_IMAGE_PDF = 5 * 1024 * 1024;

/** Vídeos (MP4, WebM, QuickTime). */
export const POST_UPLOAD_MAX_BYTES_VIDEO = 50 * 1024 * 1024;

/** @deprecated Usar `maxPostUploadBytesForMime` o constantes por tipo. */
export const POST_UPLOAD_MAX_BYTES = POST_UPLOAD_MAX_BYTES_VIDEO;

export function maxPostUploadBytesForMime(mime: string): number {
  const m = mime.toLowerCase();
  if (m.startsWith("video/")) return POST_UPLOAD_MAX_BYTES_VIDEO;
  return POST_UPLOAD_MAX_BYTES_IMAGE_PDF;
}

/** Límite efectivo en cliente para un `File` (por `type`). */
export function maxPostUploadBytesForFile(file: File): number {
  return maxPostUploadBytesForMime(file.type || "");
}

/** Texto corto para mostrar el límite en la UI en español. */
export function postUploadMaxSizeLabelEs(): string {
  return "5 MB (imágenes y PDF) · 50 MB (vídeo)";
}

export function partitionPostUploadFilesBySize(
  files: readonly File[]
): { accepted: File[]; rejected: File[] } {
  const accepted: File[] = [];
  const rejected: File[] = [];
  for (const f of files) {
    if (f.size <= 0) continue;
    if (f.size > maxPostUploadBytesForFile(f)) rejected.push(f);
    else accepted.push(f);
  }
  return { accepted, rejected };
}
