import { z } from "zod";

/** Límites alineados con validación servidor y UX (título corto estilo redes). */
export const POST_TITLE_MAX_CHARS = 80;
export const POST_BODY_MAX_CHARS = 200;

export const postsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(20),
  cursor: z.string().min(1).optional(),
  /** Solo admins: lista solo sus publicaciones paginadas. */
  mine: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});

export type PostsListQuery = z.infer<typeof postsListQuerySchema>;

export const postCursorPayloadSchema = z.object({
  created_at: z.string(),
  post_id: z.string().uuid(),
});

export function encodePostCursor(
  created_at: Date,
  post_id: string
): string {
  const payload = postCursorPayloadSchema.parse({
    created_at: created_at.toISOString(),
    post_id,
  });
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function parsePostCursor(
  encoded: string
): { created_at: Date; post_id: string } | null {
  let raw: unknown;
  try {
    raw = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as unknown;
  } catch {
    return null;
  }
  const parsed = postCursorPayloadSchema.safeParse(raw);
  if (!parsed.success) return null;
  const created_at = new Date(parsed.data.created_at);
  if (Number.isNaN(created_at.getTime())) return null;
  return { created_at, post_id: parsed.data.post_id };
}

export const createPostFormSchema = z.object({
  title: z.string().trim().min(1).max(POST_TITLE_MAX_CHARS),
  body: z.string().max(POST_BODY_MAX_CHARS).optional(),
});

export type CreatePostFormInput = z.infer<typeof createPostFormSchema>;

/** Edición multipart: mismo cuerpo que creación más lista opcional de adjuntos eliminados. */
export const updatePostFormFieldsSchema = z.object({
  title: z.string().trim().min(1).max(POST_TITLE_MAX_CHARS),
  body: z.string().max(POST_BODY_MAX_CHARS).optional(),
});

export type UpdatePostFormFields = z.infer<typeof updatePostFormFieldsSchema>;
