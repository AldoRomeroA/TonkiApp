"use client";

import { FallbackNextImage } from "src/components/FallbackNextImage";
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  POST_MAX_ATTACHMENTS,
  partitionPostUploadFilesBySize,
  postUploadMaxSizeLabelEs,
} from "src/lib/posts/constants";
import {
  POST_BODY_MAX_CHARS,
  POST_TITLE_MAX_CHARS,
} from "src/lib/posts/schemas";
import { readJsonSafely } from "src/lib/api/readJsonSafely";
import { notifyPostUploadWeightRejected } from "src/lib/posts/notifyUploadRejected";
import { ImageAttachmentGrid } from "./ImageAttachmentGrid";

let composerIdSeq = 0;
function newLocalId(): string {
  composerIdSeq++;
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${composerIdSeq}_${Math.random().toString(16).slice(2)}`;
}

type LocalDraftFile = {
  id: string;
  file: File;
  previewUrl: string | null;
};

export type PostComposerFormProps = {
  className?: string;
  /** Called after a successful publish (feed can refetch). */
  onPublished?: () => void;
};

export function PostComposerForm({
  className,
  onPublished,
}: PostComposerFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [drafts, setDrafts] = useState<LocalDraftFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  const attachmentsLeft = POST_MAX_ATTACHMENTS - drafts.length;
  const canAddMore = attachmentsLeft > 0;

  const titleLen = title.length;
  const bodyLen = body.length;

  const addPickers = useCallback((files: readonly File[]) => {
    if (!files.length) return;

    const snapshot = [...files];

    const { accepted, rejected } = partitionPostUploadFilesBySize(snapshot);

    if (rejected.length > 0) {
      setFeedback({
        kind: "error",
        text: notifyPostUploadWeightRejected(rejected),
      });
    } else {
      setFeedback(null);
    }

    if (accepted.length === 0) return;

    setDrafts((prev) => {
      const next: LocalDraftFile[] = [];
      for (const file of accepted) {
        if (prev.length + next.length >= POST_MAX_ATTACHMENTS) break;
        const mime = file.type.toLowerCase();
        const previewUrl =
          mime.startsWith("image/") || mime.startsWith("video/")
            ? URL.createObjectURL(file)
            : null;
        next.push({
          id: newLocalId(),
          file,
          previewUrl,
        });
      }
      if (next.length === 0) return prev;
      return [...prev, ...next].slice(0, POST_MAX_ATTACHMENTS);
    });
  }, []);

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const d = prev.find((x) => x.id === id);
      if (d?.previewUrl) URL.revokeObjectURL(d.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const imageDraftItems = useMemo(
    () =>
      drafts
        .filter((d) => d.file.type.toLowerCase().startsWith("image/"))
        .filter((d): d is LocalDraftFile & { previewUrl: string } =>
          Boolean(d.previewUrl)
        )
        .map((d) => ({
          key: d.id,
          src: d.previewUrl,
          alt: d.file.name.trim() || undefined,
        })),
    [drafts]
  );

  const videoDrafts = useMemo(
    () => drafts.filter((d) => d.file.type.toLowerCase().startsWith("video/")),
    [drafts]
  );

  const pdfDrafts = useMemo(
    () =>
      drafts.filter((d) => {
        const m = d.file.type.toLowerCase();
        return !m.startsWith("image/") && !m.startsWith("video/");
      }),
    [drafts]
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setFeedback(null);

      if (!title.trim()) {
        setFeedback({ kind: "error", text: "El título es obligatorio." });
        return;
      }

      const { rejected: rejectsSubmit } = partitionPostUploadFilesBySize(
        drafts.map((d) => d.file)
      );
      if (rejectsSubmit.length > 0) {
        setFeedback({
          kind: "error",
          text: notifyPostUploadWeightRejected(rejectsSubmit),
        });
        return;
      }

      setSubmitting(true);
      try {
        const fd = new FormData();
        fd.append("title", title.trim());
        if (body.trim()) fd.append("body", body.trim());
        for (const d of drafts) {
          fd.append("files", d.file);
        }

        const res = await fetch("/api/posts", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const payload = await readJsonSafely<{
          success: boolean;
          error?: string;
          message?: string;
        }>(res);

        if (!res.ok) {
          const errText = payload?.error ?? "No se pudo publicar.";
          setFeedback({
            kind: "error",
            text: errText,
          });
          if (
            typeof window !== "undefined" &&
            errText.includes("demasiado grande")
          ) {
            window.setTimeout(() => {
              window.alert(
                `Límite de peso\n\n${errText}\n\nCada archivo puede pesar como máximo ${postUploadMaxSizeLabelEs()}.`
              );
            }, 0);
          }
          return;
        }

        for (const d of drafts) {
          if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        }
        setDrafts([]);
        setTitle("");
        setBody("");
        setFeedback({
          kind: "success",
          text: payload?.message ?? "Publicado correctamente.",
        });
        onPublished?.();
      } catch (err) {
        console.error(err);
        setFeedback({
          kind: "error",
          text: "Error de red. Intenta de nuevo.",
        });
      } finally {
        setSubmitting(false);
      }
    },
    [title, body, drafts, onPublished]
  );

  return (
    <form
      className={className}
      onSubmit={handleSubmit}
    >
      <div className="flex gap-3">
        <div className="mt-2 h-10 w-10 shrink-0 overflow-hidden rounded-full border border-tonki-border bg-tonki-surface">
          <FallbackNextImage
            src="/logo.png"
            alt=""
            width={40}
            height={40}
            className="h-full w-full object-cover opacity-90"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <input
            required
            name="postTitle"
            value={title}
            maxLength={POST_TITLE_MAX_CHARS}
            onChange={(e) => {
              setFeedback(null);
              setTitle(e.target.value);
            }}
            className="w-full border-0 border-b border-transparent bg-transparent pb-3 text-xl font-semibold text-tonki-text placeholder:text-tonki-text-faint outline-none transition focus:border-tonki-border"
            placeholder="Título · que sepan de qué va"
          />
          <textarea
            name="postBody"
            value={body}
            onChange={(e) => {
              setFeedback(null);
              setBody(e.target.value);
            }}
            rows={4}
            maxLength={POST_BODY_MAX_CHARS}
            className="min-h-[100px] w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-tonki-text-secondary placeholder:text-tonki-text-faint outline-none"
            placeholder="¿Qué está pasando?"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-tonki-text-muted">
            <span>
              Cupos libres {attachmentsLeft}/{POST_MAX_ATTACHMENTS} · máx.{" "}
              {postUploadMaxSizeLabelEs()} por archivo
            </span>
            <span className="tabular-nums">
              Título{" "}
              <span
                className={
                  titleLen >= POST_TITLE_MAX_CHARS ? "text-amber-500" : ""
                }
              >
                {titleLen}/{POST_TITLE_MAX_CHARS}
              </span>
              <span className="mx-2 text-tonki-text-faint">·</span>
              Texto{" "}
              <span
                className={
                  bodyLen >= POST_BODY_MAX_CHARS ? "text-amber-500" : ""
                }
              >
                {bodyLen}/{POST_BODY_MAX_CHARS}
              </span>
            </span>
          </div>
        </div>
      </div>

      {imageDraftItems.length > 0 && (
        <ImageAttachmentGrid
          items={imageDraftItems}
          overlay={(item) => (
            <button
              type="button"
              aria-label={`Quitar ${item.alt ?? "adjunto"}`}
              className="absolute right-2 top-2 z-20 rounded-full bg-tonki-media-bg/70 px-2 py-0.5 text-xs font-semibold text-tonki-chrome-text ring-1 ring-tonki-chrome-border hover:bg-red-950/90"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeDraft(item.key);
              }}
            >
              ×
            </button>
          )}
        />
      )}

      {videoDrafts.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {videoDrafts.map((d) => (
            <li
              key={d.id}
              className="relative overflow-hidden rounded-2xl border border-tonki-border bg-tonki-media-bg"
            >
              {d.previewUrl ? (
                <video
                  className="max-h-52 w-full object-contain"
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
                aria-label="Quitar vídeo"
                className="absolute right-2 top-2 z-20 rounded-full bg-tonki-media-bg/80 px-2 py-0.5 text-xs font-semibold text-tonki-chrome-text ring-1 ring-tonki-chrome-border hover:bg-red-950/90"
                onClick={() => removeDraft(d.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {pdfDrafts.length > 0 && (
        <ul className="flex flex-col gap-2">
          {pdfDrafts.map((d) => {
            const label = d.file.name.trim() || d.file.type || "Adjunto";
            return (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-tonki-border px-3 py-2"
              >
                <span className="truncate text-xs text-tonki-text-muted">{label}</span>
                <button
                  type="button"
                  aria-label={`Quitar ${label}`}
                  onClick={() => removeDraft(d.id)}
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold text-tonki-text-muted ring-1 ring-tonki-border-strong hover:bg-red-50"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-tonki-border pt-3">
        <label className="cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-tonki-text-muted transition hover:bg-tonki-surface-hover hover:text-tonki-text">
          Añadir
          <input
            type="file"
            name="composerFiles"
            multiple
            className="sr-only"
            accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm,video/quicktime"
            disabled={!canAddMore}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              addPickers(picked);
              const input = e.currentTarget;
              queueMicrotask(() => {
                input.value = "";
              });
            }}
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-tonki-accent px-5 py-2 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover sm:text-base disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Publicando…" : "Publicar"}
        </button>
      </div>

      {feedback && (
        <p
          className={
            feedback.kind === "error"
              ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-tonki-danger"
              : "text-sm text-emerald-700"
          }
          role={feedback.kind === "error" ? "alert" : "status"}
          aria-live={feedback.kind === "error" ? "assertive" : "polite"}
        >
          {feedback.text}
        </p>
      )}
    </form>
  );
}
