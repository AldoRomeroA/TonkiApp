import path from "path";

/**
 * Resuelve la ruta absoluta para borrar un adjunto solo si `url` pertenece a
 * `public/uploads/posts/{postId}/` (evita path traversal con URLs falsas en BD).
 */
export function resolveSafePostAttachmentPath(
  publicUrl: string,
  expectedPostId: string
): string | null {
  const rel = publicUrl.startsWith("/") ? publicUrl.slice(1) : publicUrl;
  if (!rel || rel.includes("..")) {
    return null;
  }
  const normalized = path.normalize(rel).replace(/\\/g, "/");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return null;
  }
  const expectedDir = path.posix.join("uploads/posts", expectedPostId);
  const prefix = `${expectedDir}/`;
  if (!(normalized.startsWith(prefix) || normalized === expectedDir)) {
    return null;
  }

  const publicRoot = path.join(process.cwd(), "public");
  const resolvedPublic = path.resolve(publicRoot);
  const resolvedFile = path.resolve(path.join(publicRoot, normalized));

  if (
    resolvedFile !== resolvedPublic &&
    !resolvedFile.startsWith(resolvedPublic + path.sep)
  ) {
    return null;
  }

  const uploadsBase = path.join(resolvedPublic, "uploads", "posts");
  const scopedDir = path.join(uploadsBase, expectedPostId);
  if (
    resolvedFile !== scopedDir &&
    !resolvedFile.startsWith(scopedDir + path.sep)
  ) {
    return null;
  }

  return resolvedFile;
}
