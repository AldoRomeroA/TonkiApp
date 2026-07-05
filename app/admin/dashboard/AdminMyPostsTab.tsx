"use client";

import { FallbackNextImage } from "src/components/FallbackNextImage";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import {
  POST_MAX_ATTACHMENTS,
  partitionPostUploadFilesBySize,
  postUploadMaxSizeLabelEs,
} from "src/lib/posts/constants";
import { notifyPostUploadWeightRejected } from "src/lib/posts/notifyUploadRejected";
import {
  filterImageAttachments,
  filterVideoAttachments,
  isPostAttachmentImageMime,
  isPostAttachmentVideoMime,
} from "src/lib/posts/attachmentMime";
import {
  POST_BODY_MAX_CHARS,
  POST_TITLE_MAX_CHARS,
} from "src/lib/posts/schemas";
import { ImageAttachmentGrid } from "../../(app)/dashboard/ImageAttachmentGrid";
import type { FeedPost, FeedPostAttachment } from "src/lib/posts/feedTypes";
import { fetchPostsListPage } from "src/lib/posts/fetchPostsListClient";

const PAGE_SIZE = 20;

let editDraftSeq = 0;
function newLocalId(): string {
  editDraftSeq++;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${editDraftSeq}_${Math.random().toString(16).slice(2)}`;
}

type LocalDraftFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

type SavedPostPatch = {
  post_id: string;
  updated_at: string;
  was_edited: boolean;
  title: string;
  body: string | null;
};

type EditSheetProps = {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
  onSaved: (patch?: SavedPostPatch) => void;
};

function EditPostSheet({ post, open, onClose, onSaved }: EditSheetProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<LocalDraftFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !post) return;
    setTitle(post.title);
    setBody(post.body ?? "");
    setRemovedIds([]);
    setDrafts((prev) => {
      for (const d of prev) {
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      }
      return [];
    });
    setError(null);
  }, [open, post]);

  const visibleExisting = useMemo(() => {
    if (!post) return [];
    return post.attachments.filter((a) => !removedIds.includes(a.attachment_id));
  }, [post, removedIds]);

  const attachmentsLeft = POST_MAX_ATTACHMENTS - (visibleExisting.length + drafts.length);
  const canAddMore = attachmentsLeft > 0;

  const toggleExisting = useCallback((attachmentId: string) => {
    setRemovedIds((prev) =>
      prev.includes(attachmentId)
        ? prev.filter((id) => id !== attachmentId)
        : [...prev, attachmentId]
    );
  }, []);

  const existingImages = useMemo(() => {
    if (!post) return [];
    return post.attachments.filter((a) => isPostAttachmentImageMime(a.mime_type));
  }, [post]);

  const draftImages = useMemo(
    () =>
      drafts.filter(
        (d): d is LocalDraftFile & { previewUrl: string } =>
          d.file.type.toLowerCase().startsWith("image/") && Boolean(d.previewUrl)
      ),
    [drafts]
  );

  const draftVideos = useMemo(
    () => drafts.filter((d) => d.file.type.toLowerCase().startsWith("video/")),
    [drafts]
  );

  const existingVideos = useMemo(() => {
    if (!post) return [];
    return post.attachments.filter((a) =>
      isPostAttachmentVideoMime(a.mime_type)
    );
  }, [post]);

  const existingDocs = useMemo(() => {
    if (!post) return [];
    return post.attachments.filter(
      (a) =>
        !isPostAttachmentImageMime(a.mime_type) &&
        !isPostAttachmentVideoMime(a.mime_type)
    );
  }, [post]);

  const docDraftsOnly = useMemo(
    () =>
      drafts.filter((d) => {
        const m = d.file.type.toLowerCase();
        return !m.startsWith("image/") && !m.startsWith("video/");
      }),
    [drafts]
  );

  const addDrafts = useCallback(
    (
      files: readonly File[],
      postAttachments: FeedPostAttachment[],
      removed: string[]
    ) => {
      if (!files.length) return;

      const snapshot = [...files];
      const { accepted, rejected } = partitionPostUploadFilesBySize(snapshot);

      if (rejected.length > 0) {
        setError(notifyPostUploadWeightRejected(rejected));
      }

      if (accepted.length === 0) return;

      setDrafts((prev) => {
        const keptLen = postAttachments.filter(
          (a) => !removed.includes(a.attachment_id)
        ).length;
        const slots = POST_MAX_ATTACHMENTS - keptLen - prev.length;
        if (slots <= 0) return prev;
        const next: LocalDraftFile[] = [];
        for (const file of accepted) {
          if (next.length >= slots) break;
          const mime = file.type.toLowerCase();
          const previewUrl =
            mime.startsWith("image/") || mime.startsWith("video/")
              ? URL.createObjectURL(file)
              : null;
          next.push({ id: newLocalId(), file, previewUrl });
        }
        if (next.length === 0) return prev;
        return [...prev, ...next];
      });
    },
    []
  );

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!post) return;
      setError(null);
      if (!title.trim()) {
        setError("El título es obligatorio.");
        return;
      }
      const keptLen = visibleExisting.length;
      if (keptLen + drafts.length > POST_MAX_ATTACHMENTS) {
        setError(`Máximo ${POST_MAX_ATTACHMENTS} adjuntos.`);
        return;
      }

      const { rejected: rejNew } = partitionPostUploadFilesBySize(
        drafts.map((d) => d.file)
      );
      if (rejNew.length > 0) {
        setError(notifyPostUploadWeightRejected(rejNew));
        return;
      }

      setSubmitting(true);
      try {
        const fd = new FormData();
        fd.append("title", title.trim());
        if (body.trim()) fd.append("body", body.trim());
        if (removedIds.length > 0) {
          fd.append("removedAttachmentIds", JSON.stringify(removedIds));
        }
        for (const d of drafts) {
          fd.append("files", d.file);
        }

        const res = await fetch(`/api/posts/${post.post_id}`, {
          method: "PATCH",
          credentials: "include",
          body: fd,
        });

        const payload = await readJsonSafely<{
          success?: boolean;
          error?: string;
          updated_at?: string;
          was_edited?: boolean;
        }>(res);
        if (!res.ok || payload?.success === false) {
          const errText = payload?.error ?? `Error ${res.status}`;
          setError(errText);
          if (
            typeof window !== "undefined" &&
            errText.includes("demasiado grande")
          ) {
            window.setTimeout(() => {
              window.alert(
                `Límite de peso\n\n${errText}\n\nMáximo por archivo: ${postUploadMaxSizeLabelEs()}.`
              );
            }, 0);
          }
          return;
        }

        for (const d of drafts) {
          if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        }
        if (
          typeof payload?.updated_at === "string" &&
          payload.success === true
        ) {
          onSaved({
            post_id: post.post_id,
            updated_at: payload.updated_at,
            was_edited: Boolean(payload.was_edited),
            title: title.trim(),
            body: body.trim().length > 0 ? body.trim() : null,
          });
        } else {
          onSaved();
        }
        onClose();
      } catch {
        setError("Error de red. Intenta de nuevo.");
      } finally {
        setSubmitting(false);
      }
    },
    [
      body,
      drafts,
      onClose,
      onSaved,
      post,
      title,
      visibleExisting.length,
      removedIds,
    ]
  );

  const titleLen = title.length;
  const bodyLen = body.length;

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Cerrar editor"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[1] flex max-h-[min(92vh,720px)] w-full max-w-lg flex-col rounded-t-2xl border border-tonki-border bg-tonki-surface shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-tonki-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1.5 text-[15px] text-tonki-text-secondary hover:bg-tonki-surface-hover"
          >
            Cancelar
          </button>
          <span className="text-sm font-semibold text-tonki-text-muted">
            Editar publicación
          </span>
          <button
            type="submit"
            form="edit-post-form"
            disabled={submitting}
            className="rounded-full bg-tonki-accent px-4 py-2 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover sm:text-base disabled:opacity-60"
          >
            {submitting ? "Guardando…" : "Guardar"}
          </button>
        </div>

        <form
          id="edit-post-form"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
        >
          <input
            maxLength={POST_TITLE_MAX_CHARS}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-tonki-border bg-tonki-surface px-3 py-2 text-tonki-text outline-none focus:border-tonki-accent"
          />
          <textarea
            maxLength={POST_BODY_MAX_CHARS}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl border border-tonki-border bg-tonki-surface px-3 py-2 text-tonki-text outline-none focus:border-tonki-accent"
          />
          <p className="text-xs text-tonki-text-muted tabular-nums">
            Título {titleLen}/{POST_TITLE_MAX_CHARS} · Texto {bodyLen}/
            {POST_BODY_MAX_CHARS}
          </p>

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-tonki-text-muted">
              Adjuntos ({visibleExisting.length + drafts.length}/
              {POST_MAX_ATTACHMENTS})
            </p>

            {existingImages.length > 0 && (
              <ImageAttachmentGrid
                className="m-0 grid w-full list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3"
                items={existingImages.map((a) => ({
                  key: a.attachment_id,
                  src: a.url,
                  alt: a.original_name?.trim() ?? "",
                }))}
                getItemLiClassName={(idx) => {
                  const id = existingImages[idx]?.attachment_id;
                  if (!id) return undefined;
                  return removedIds.includes(id) ? "opacity-40" : undefined;
                }}
                overlay={(_, index) => {
                  const att = existingImages[index];
                  if (!att) return null;
                  const off = removedIds.includes(att.attachment_id);
                  return (
                    <button
                      type="button"
                      className={`absolute right-2 top-2 z-20 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-tonki-chrome-border ${
                        off ? "bg-tonki-chrome-elevated/90" : "bg-tonki-media-bg/80"
                      }`}
                      onClick={(ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        toggleExisting(att.attachment_id);
                      }}
                    >
                      {off ? "+" : "−"}
                    </button>
                  );
                }}
              />
            )}

            {draftImages.length > 0 && (
              <ImageAttachmentGrid
                className="m-0 grid w-full list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3"
                items={draftImages.map((d) => ({
                  key: d.id,
                  src: d.previewUrl,
                  alt: d.file.name.trim() || undefined,
                }))}
                overlay={(item) => (
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-20 rounded-full bg-tonki-media-bg/80 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-tonki-chrome-border hover:bg-red-950/40"
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      removeDraft(item.key);
                    }}
                  >
                    ×
                  </button>
                )}
              />
            )}

            {(existingVideos.length > 0 ||
              existingDocs.length > 0 ||
              draftVideos.length > 0 ||
              docDraftsOnly.length > 0) && (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {existingVideos.map((a) => {
                  const off = removedIds.includes(a.attachment_id);
                  return (
                    <li
                      key={a.attachment_id}
                      className={`relative overflow-hidden rounded-xl border text-[11px] ${
                        off
                          ? "border-tonki-border-strong opacity-45"
                          : "border-tonki-border"
                      }`}
                    >
                      <video
                        className="max-h-40 w-full object-contain bg-tonki-media-bg"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        src={a.url}
                        aria-label={
                          a.original_name?.trim()
                            ? `Vídeo: ${a.original_name.trim()}`
                            : "Vídeo adjunto"
                        }
                      />
                      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-tonki-text-muted">
                        <span className="truncate font-medium">
                          {a.original_name?.trim() || "Vídeo"}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-full px-2 py-0.5 ring-1 ring-tonki-border-strong"
                          onClick={() => toggleExisting(a.attachment_id)}
                        >
                          {off ? "+" : "−"}
                        </button>
                      </div>
                    </li>
                  );
                })}
                {draftVideos.map((d) => (
                  <li
                    key={d.id}
                    className="relative overflow-hidden rounded-xl border border-tonki-border bg-tonki-media-bg"
                  >
                    {d.previewUrl ? (
                      <video
                        className="max-h-40 w-full object-contain"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                        src={d.previewUrl}
                        aria-label={
                          d.file.name.trim()
                            ? `Vista previa: ${d.file.name.trim()}`
                            : "Vista previa de vídeo"
                        }
                      />
                    ) : null}
                    <button
                      type="button"
                      className="absolute right-2 top-2 z-20 rounded-full bg-tonki-media-bg/80 px-2 py-0.5 text-[11px] font-semibold text-white ring-1 ring-tonki-chrome-border"
                      onClick={() => removeDraft(d.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
                {existingDocs.map((a) => {
                  const off = removedIds.includes(a.attachment_id);
                  return (
                    <li
                      key={a.attachment_id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] ${
                        off
                          ? "border-tonki-border-strong text-tonki-text-muted opacity-45"
                          : "border-tonki-border text-tonki-text-secondary"
                      }`}
                    >
                      <span className="truncate font-medium">
                        {a.original_name?.trim() || "Adjunto"}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full px-2 py-0.5 ring-1 ring-tonki-border-strong"
                        onClick={() => toggleExisting(a.attachment_id)}
                      >
                        {off ? "+" : "−"}
                      </button>
                    </li>
                  );
                })}
                {docDraftsOnly.map((d) => {
                  const label = d.file.name.trim() || "Adjunto";
                  return (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-tonki-border px-3 py-2 text-[11px] text-tonki-text-secondary"
                    >
                      <span className="truncate font-medium">{label}</span>
                      <button
                        type="button"
                        className="shrink-0 rounded-full px-2 py-0.5 ring-1 ring-tonki-border-strong"
                        onClick={() => removeDraft(d.id)}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-col gap-1">
              <label className="inline-flex w-fit cursor-pointer items-center rounded-full border border-tonki-border px-4 py-2 text-sm font-medium text-tonki-text-secondary hover:bg-tonki-surface-hover">
                Añadir archivos
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime"
                  disabled={!canAddMore}
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    addDrafts(picked, post.attachments, removedIds);
                    const input = e.currentTarget;
                    queueMicrotask(() => {
                      input.value = "";
                    });
                  }}
                />
              </label>
              <p className="text-[11px] text-tonki-text-muted">
                Máximo {postUploadMaxSizeLabelEs()} por archivo.
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400" aria-live="assertive">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export function AdminMyPostsTab() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editing, setEditing] = useState<FeedPost | null>(null);

  const fetchPage = useCallback(async (cursor: string | null, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const result = await fetchPostsListPage({
      limit: PAGE_SIZE,
      cursor: cursor ?? undefined,
      mine: true,
      networkErrorMessage: "No se pudieron cargar tus publicaciones",
    });

    if (!result.ok) {
      setError(result.error);
      loadingRef.current = false;
      setLoading(false);
      return;
    }

    setPosts((prev) => (append ? [...prev, ...result.posts] : result.posts));
    setNextCursor(result.nextCursor);
    loadingRef.current = false;
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingRef.current) return;
    void fetchPage(nextCursor, true);
  }, [fetchPage, nextCursor]);

  const refresh = useCallback(
    (patch?: SavedPostPatch) => {
      if (patch) {
        setPosts((prev) =>
          prev.map((p) =>
            p.post_id === patch.post_id
              ? {
                  ...p,
                  title: patch.title,
                  body: patch.body,
                  updated_at: patch.updated_at,
                  was_edited: patch.was_edited,
                }
              : p
          )
        );
      }
      void fetchPage(null, false);
    },
    [fetchPage]
  );

  const deletePost = useCallback(async (postId: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        "¿Eliminar esta publicación? Esta acción no se puede deshacer."
      );
      if (!ok) return;
    }
    setDeletingId(postId);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await readJsonSafely<{
        success?: boolean;
        error?: string;
      }>(res);
      if (!res.ok || data?.success === false) {
        setError(
          typeof data?.error === "string" ? data.error : `Error ${res.status}`
        );
        return;
      }
      setEditing((cur) => (cur?.post_id === postId ? null : cur));
      setPosts((prev) => prev.filter((p) => p.post_id !== postId));
    } catch {
      setError("No se pudo eliminar la publicación");
    } finally {
      setDeletingId(null);
    }
  }, []);

  return (
    <div className="border-x border-tonki-border min-h-[50vh]">
      <EditPostSheet
        post={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />

      {error && posts.length === 0 && (
        <p className="p-8 text-center text-sm text-red-400">{error}</p>
      )}

      {error && posts.length > 0 && (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-tonki-danger">
          {error}
        </p>
      )}

      <ul className="divide-y divide-tonki-border">
        {posts.map((p) => {
          const imgs = filterImageAttachments(p.attachments);
          const vids = filterVideoAttachments(p.attachments);
          const dt = new Date(p.updated_at).toLocaleString("es", {
            dateStyle: "medium",
            timeStyle: "short",
          });

          return (
            <li
              key={p.post_id}
              className="flex gap-3 px-4 py-4 transition hover:bg-tonki-surface-hover/80"
            >
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-tonki-border bg-tonki-surface">
                <FallbackNextImage
                  src="/logo.png"
                  alt=""
                  width={44}
                  height={44}
                  className="h-full w-full object-cover opacity-90"
                />
              </div>
              <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 gap-y-1 text-[15px]">
                  <span className="font-semibold text-tonki-text">Tú</span>
                  <time
                    className="text-xs text-tonki-text-muted"
                    dateTime={p.updated_at}
                    title={
                      p.was_edited
                        ? `Publicado: ${new Date(p.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}`
                        : undefined
                    }
                  >
                    {dt}
                  </time>
                  {p.was_edited ? (
                    <span className="rounded-md border border-tonki-border bg-tonki-elevated/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tonki-text-muted">
                      Editado
                    </span>
                  ) : null}
                  <span className="ml-auto hidden text-xs text-tonki-text-muted sm:inline">
                    {p.view_count} vistas · {p.share_count} compartidos
                  </span>
                </div>
                <p className="break-words text-[15px] font-semibold text-tonki-text">
                  {p.title}
                </p>
                {p.body?.trim() && (
                  <p className="whitespace-pre-wrap break-words text-[15px] text-tonki-text-secondary">
                    {p.body}
                  </p>
                )}
                {imgs.length > 0 && (
                  <div className="mt-2 max-w-xl">
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
                  <ul className="mt-2 flex max-w-xl flex-col gap-2">
                    {vids.map((v) => (
                      <li
                        key={v.attachment_id}
                        className="overflow-hidden rounded-xl border border-tonki-border bg-tonki-media-bg"
                      >
                        <video
                          className="max-h-48 w-full object-contain"
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
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-tonki-text-muted sm:hidden">
                    {p.view_count} vistas · {p.share_count} compartidos
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(p)}
                    className="rounded-full border border-tonki-border px-3 py-1 text-xs font-semibold text-tonki-text-secondary hover:bg-tonki-surface-hover"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={deletingId === p.post_id}
                    onClick={() => void deletePost(p.post_id)}
                    className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-tonki-danger hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === p.post_id ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!loading && posts.length === 0 && !error && (
        <p className="py-14 text-center text-sm text-tonki-text-muted">
          Aún no has publicado nada.
        </p>
      )}

      {nextCursor && (
        <div className="p-6 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full border border-tonki-border px-5 py-2 text-sm font-semibold text-tonki-text-secondary hover:bg-tonki-surface-hover disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Cargar más"}
          </button>
        </div>
      )}
    </div>
  );
}
