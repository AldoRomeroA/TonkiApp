"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  type MouseEvent,
  useRef,
  useState,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import {
  filterImageAttachments,
  filterVideoAttachments,
  isPostAttachmentImageMime,
  isPostAttachmentVideoMime,
} from "src/lib/posts/attachmentMime";
import type { FeedPost, FeedPostAttachment } from "src/lib/posts/feedTypes";
import { fetchPostsListPage } from "src/lib/posts/fetchPostsListClient";
import {
  appendProceduralBatch,
  isProceduralPostId,
  PROCEDURAL_LOAD_DELAY_MS,
  resolveFeedSource,
  sleep,
  toFeedItems,
  type FeedPostItem,
} from "src/lib/posts/proceduralFeed";

import { ImageAttachmentGrid } from "./ImageAttachmentGrid";
import { FeedComposer } from "./FeedComposer";
import { PostOverlayModal } from "./PostOverlayModal";
import { PostShareButton } from "./PostShareButton";

export type {
  FeedPost,
  FeedPostAttachment,
  FeedPostAuthor,
  PostsListErrorBody,
} from "src/lib/posts/feedTypes";
export { isPostsSuccess } from "src/lib/posts/feedTypes";

const PAGE_SIZE = 20;

function nonImageNonVideoAttachments(attachments: FeedPostAttachment[]) {
  return attachments.filter(
    (a) =>
      !isPostAttachmentImageMime(a.mime_type) &&
      !isPostAttachmentVideoMime(a.mime_type)
  );
}

function bodySnippet(body: string | null, maxLen = 200): string | null {
  if (!body?.trim()) return null;
  const t = body.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen).trim()}…`;
}

function PostViewCount({
  postId,
  initial,
}: {
  postId: string;
  initial: number;
}) {
  const [count, setCount] = useState(initial);
  const ref = useRef<HTMLSpanElement | null>(null);
  const sentRef = useRef(false);
  const trackViews = !isProceduralPostId(postId);

  useEffect(() => {
    if (!trackViews) return;
    const key = `tonki_view:${postId}`;
    const root = ref.current?.closest("article");
    const el = root ?? ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some(
          (entry) =>
            entry.isIntersecting &&
            typeof entry.intersectionRatio === "number" &&
            entry.intersectionRatio >= 0.28
        );
        if (!hit) return;

        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) {
          sentRef.current = true;
          return;
        }
        if (sentRef.current) return;
        sentRef.current = true;

        void (async () => {
          try {
            const res = await fetch(`/api/posts/${postId}/view`, {
              method: "POST",
              credentials: "include",
            });
            const data = await readJsonSafely<Record<string, unknown>>(res);
            if (
              res.ok &&
              data?.success === true &&
              typeof data.view_count === "number"
            ) {
              setCount(data.view_count);
              sessionStorage.setItem(key, "1");
            } else {
              sentRef.current = false;
            }
          } catch {
            sentRef.current = false;
          }
        })();
      },
      { threshold: [0, 0.28, 0.45] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [postId, trackViews]);

  return (
    <span ref={ref} className="text-sm text-tonki-text-faint">
      {count} vistas
    </span>
  );
}

export function PostFeed() {
  const [feedItems, setFeedItems] = useState<FeedPostItem[]>([]);
  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [apiNextCursor, setApiNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const proceduralBatchRef = useRef(0);
  const canonicalPostsRef = useRef<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const fetchPage = useCallback(async (cursor: string | null, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    setUnauthorized(false);

    const result = await fetchPostsListPage({
      limit: PAGE_SIZE,
      cursor: cursor ?? undefined,
      networkErrorMessage: "No se pudo cargar el feed",
    });

    if (!result.ok) {
      if (result.unauthorized) setUnauthorized(true);
      else setError(result.error);
      loadingRef.current = false;
      setLoading(false);
      return;
    }

    if (append) {
      const seen = new Set(canonicalPostsRef.current.map((p) => p.post_id));
      const merged = [...canonicalPostsRef.current];
      for (const post of result.posts) {
        if (!seen.has(post.post_id)) {
          seen.add(post.post_id);
          merged.push(post);
        }
      }
      canonicalPostsRef.current = merged;
      setFeedItems((prev) => [
        ...prev,
        ...toFeedItems(result.posts, cursor ?? "api"),
      ]);
    } else {
      canonicalPostsRef.current = result.posts;
      proceduralBatchRef.current = 0;
      const initial = resolveFeedSource(result.posts);
      setFeedItems(toFeedItems(initial, "init"));
    }
    setApiNextCursor(result.nextCursor);
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchPage(null, false);
    });
  }, [fetchPage]);

  const loadProceduralBatch = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    await sleep(PROCEDURAL_LOAD_DELAY_MS);

    const batchIndex = proceduralBatchRef.current;
    proceduralBatchRef.current += 1;
    const batch = appendProceduralBatch(canonicalPostsRef.current, batchIndex);
    setFeedItems((prev) => [...prev, ...batch]);

    loadingRef.current = false;
    setLoading(false);
  }, []);

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    if (apiNextCursor !== null) {
      void fetchPage(apiNextCursor, true);
      return;
    }
    void loadProceduralBatch();
  }, [apiNextCursor, fetchPage, loadProceduralBatch]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !loadingRef.current) {
          loadMore();
        }
      },
      { root: null, rootMargin: "240px", threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const setPostQuery = useCallback(
    (postId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (postId) next.set("post", postId);
      else next.delete("post");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const openPost = useCallback(
    (post: FeedPost) => {
      setActivePost(post);
      setPostQuery(post.post_id);
    },
    [setPostQuery]
  );

  const closePost = useCallback(() => {
    setActivePost(null);
    setPostQuery(null);
  }, [setPostQuery]);

  useEffect(() => {
    const requestedPostId = searchParams.get("post");
    if (!requestedPostId) {
      queueMicrotask(() => {
        setActivePost(null);
      });
      return;
    }
    if (activePost?.post_id === requestedPostId) return;

    const existing = feedItems.find((p) => p.post_id === requestedPostId);
    if (existing) {
      queueMicrotask(() => {
        setActivePost(existing);
      });
      return;
    }

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`/api/posts/${requestedPostId}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const data = await readJsonSafely<{ success?: boolean; post?: FeedPost }>(res);
        if (res.ok && data?.success === true && data.post) {
          setActivePost(data.post);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // No-op: keep feed usable if deep-link fetch fails.
      }
    })();
    return () => controller.abort();
  }, [activePost?.post_id, feedItems, searchParams]);

  if (unauthorized) {
    return (
      <div className="rounded-2xl border border-tonki-border bg-tonki-surface p-8 text-center">
        <p className="text-base text-tonki-text-secondary">
          Necesitas iniciar sesión para ver el feed.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-block text-sm font-semibold text-tonki-accent underline-offset-4 hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  if (error && feedItems.length === 0) {
    return (
      <div className="rounded-2xl border border-tonki-border bg-tonki-surface p-8 text-center">
        <p className="text-base text-tonki-danger">{error}</p>
        <button
          type="button"
          onClick={() => void fetchPage(null, false)}
          className="mt-4 rounded-xl border border-tonki-accent px-5 py-2.5 text-sm font-semibold text-tonki-accent transition-colors hover:bg-tonki-accent hover:text-tonki-accent-fg"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const canOpenModalFromTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return true;
    if (target.closest("a, button, input, textarea, select, video")) return false;
    return true;
  };

  const onPostClick = (event: MouseEvent<HTMLElement>, post: FeedPost) => {
    if (!canOpenModalFromTarget(event.target)) return;
    openPost(post);
  };

  return (
    <div className="flex flex-col border-x border-tonki-border">
      <div className="border-b border-tonki-border bg-tonki-canvas px-4 py-3 sm:px-5">
        <h2 className="text-xl font-bold tracking-tight text-tonki-text">Inicio</h2>
      </div>
      <FeedComposer
        onPublished={() => {
          void fetchPage(null, false);
        }}
      />
      {feedItems.map((post) => {
        const imgs = filterImageAttachments(post.attachments);
        const vids = filterVideoAttachments(post.attachments);
        const files = nonImageNonVideoAttachments(post.attachments);
        const snippet = bodySnippet(post.body);
        const dateLabel = new Date(post.updated_at).toLocaleString("es", {
          dateStyle: "medium",
          timeStyle: "short",
        });

        return (
          <article
            key={post.feedKey}
            className="cursor-pointer border-b border-tonki-border px-5 py-5 transition-colors hover:bg-tonki-surface-hover/80"
            onClick={(event) => onPostClick(event, post)}
            onKeyDown={(event) => {
              if (!canOpenModalFromTarget(event.target)) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openPost(post);
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Abrir publicación: ${post.title}`}
          >
            <div className="flex gap-4">
              <div className="mt-1 h-11 w-11 shrink-0 overflow-hidden rounded-full border border-tonki-border bg-tonki-canvas">
                {/* eslint-disable-next-line @next/next/no-img-element -- small avatar from static asset */}
                <img
                  src="/logo.png"
                  alt=""
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-tonki-text">
                    {post.author.name}
                  </span>
                  <span className="text-tonki-text-faint" aria-hidden>
                    ·
                  </span>
                  <time
                    className="text-tonki-text-muted"
                    dateTime={post.updated_at}
                    title={
                      post.was_edited
                        ? `Publicado: ${new Date(post.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}`
                        : undefined
                    }
                  >
                    {dateLabel}
                  </time>
                  {post.was_edited ? (
                    <span className="rounded-md border border-tonki-border bg-tonki-elevated/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-tonki-text-muted">
                      Editado
                    </span>
                  ) : null}
                </div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight text-tonki-text sm:text-xl">
                  {post.title}
                </h2>
                {snippet && (
                  <p className="text-base leading-relaxed text-tonki-text-secondary whitespace-pre-wrap">
                    {snippet}
                  </p>
                )}
                {imgs.length > 0 && (
                  <div className="mt-4 max-w-xl">
                    <ImageAttachmentGrid
                      items={imgs.map((a) => ({
                        key: a.attachment_id,
                        src: a.url,
                        alt: a.original_name?.trim() ?? "",
                      }))}
                    />
                  </div>
                )}
                {vids.length > 0 && (
                  <ul className="mt-4 flex max-w-xl flex-col gap-3">
                    {vids.map((v) => (
                      <li key={v.attachment_id} className="overflow-hidden rounded-2xl border border-tonki-border bg-black">
                        <video
                          className="max-h-[min(70vh,480px)] w-full object-contain"
                          controls
                          playsInline
                          preload="metadata"
                          src={v.url}
                          aria-label={
                            v.original_name?.trim()
                              ? `Vídeo: ${v.original_name.trim()}`
                              : "Vídeo de la publicación"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                )}
                {files.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-2">
                    {files.map((f) => (
                      <li key={f.attachment_id}>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm font-medium text-tonki-accent underline-offset-2 hover:underline"
                        >
                          {f.original_name?.trim() || f.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex max-w-md flex-wrap items-center justify-between gap-3 border-t border-tonki-border/60 pt-3">
                  <PostShareButton
                    postId={post.post_id}
                    title={post.title}
                    initialShareCount={post.share_count ?? 0}
                  />
                  <PostViewCount
                    key={`${post.post_id}:${post.view_count ?? 0}`}
                    postId={post.post_id}
                    initial={post.view_count ?? 0}
                  />
                </div>
              </div>
            </div>
          </article>
        );
      })}

      {error && feedItems.length > 0 && (
        <p className="py-4 text-center text-sm text-tonki-danger">{error}</p>
      )}

      <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />

      {loading && (
        <p className="py-3 text-center text-sm text-tonki-text-muted">
          Cargando…
        </p>
      )}
      <PostOverlayModal post={activePost} onClose={closePost} />
    </div>
  );
}
