/** MIME tratado como imagen en grids de adjuntos (coincide con tipos permitidos en upload). */
export function isPostAttachmentImageMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("image/");
}

export function isPostAttachmentVideoMime(mime: string): boolean {
  return mime.toLowerCase().startsWith("video/");
}

export function filterImageAttachments<T extends { mime_type: string }>(
  attachments: readonly T[]
): T[] {
  return attachments.filter((a) => isPostAttachmentImageMime(a.mime_type));
}

export function filterVideoAttachments<T extends { mime_type: string }>(
  attachments: readonly T[]
): T[] {
  return attachments.filter((a) => isPostAttachmentVideoMime(a.mime_type));
}
