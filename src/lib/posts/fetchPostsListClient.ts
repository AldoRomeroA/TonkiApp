import { readJsonSafely } from "src/lib/api/readJsonSafely";

import {
  type FeedPost,
  isPostsSuccess,
  type PostsListErrorBody,
} from "./feedTypes";

export type FetchPostsListPageResult =
  | { ok: true; posts: FeedPost[]; nextCursor: string | null }
  | { ok: false; error: string; unauthorized?: true };

/**
 * `GET /api/posts` desde el navegador (cookies de sesión).
 */
export async function fetchPostsListPage(opts: {
  limit: number;
  cursor?: string | null;
  /** Lista solo publicaciones del autor; requiere sesión admin. */
  mine?: boolean;
  networkErrorMessage: string;
}): Promise<FetchPostsListPageResult> {
  const params = new URLSearchParams({ limit: String(opts.limit) });
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.mine) params.set("mine", "1");

  try {
    const res = await fetch(`/api/posts?${params.toString()}`, {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      return { ok: false, error: "No autenticado", unauthorized: true };
    }

    const data = await readJsonSafely(res);
    if (data === null) {
      return { ok: false, error: "Respuesta inválida del servidor" };
    }

    if (!res.ok) {
      const err = data as Partial<PostsListErrorBody>;
      return { ok: false, error: err.error || `Error ${res.status}` };
    }

    if (!isPostsSuccess(data)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    return {
      ok: true,
      posts: data.posts,
      nextCursor: data.nextCursor,
    };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}
