export type FeedPostAuthor = {
  user_id: string;
  name: string;
};

export type FeedPostAttachment = {
  attachment_id: string;
  url: string;
  mime_type: string;
  original_name?: string | null;
};

export type FeedPost = {
  post_id: string;
  title: string;
  body: string | null;
  view_count: number;
  created_at: string;
  /** Última modificación (igual a `created_at` hasta la primera edición). */
  updated_at: string;
  /** `true` si el post se editó después de publicarse. */
  was_edited: boolean;
  author: FeedPostAuthor;
  attachments: FeedPostAttachment[];
};

type PostsListSuccessBody = {
  success: true;
  posts: FeedPost[];
  nextCursor: string | null;
};

export type PostsListErrorBody = {
  success: false;
  error: string;
};

/** Respuesta JSON de `GET /api/posts` con `success: true` y forma esperada. */
export function isPostsSuccess(data: unknown): data is PostsListSuccessBody {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  if (!Array.isArray(o.posts)) return false;
  if (!("nextCursor" in o)) return false;
  const nc = o.nextCursor;
  if (nc !== null && typeof nc !== "string") return false;
  return true;
}
