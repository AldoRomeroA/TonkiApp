"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

import {
  filterImageAttachments,
  filterVideoAttachments,
  isPostAttachmentImageMime,
  isPostAttachmentVideoMime,
} from "src/lib/posts/attachmentMime";
import type { FeedPost } from "src/lib/posts/feedTypes";

import { ImageAttachmentGrid } from "./ImageAttachmentGrid";

function nonImageNonVideoAttachments(post: FeedPost) {
  return post.attachments.filter(
    (a) =>
      !isPostAttachmentImageMime(a.mime_type) &&
      !isPostAttachmentVideoMime(a.mime_type)
  );
}

type PostOverlayModalProps = {
  post: FeedPost | null;
  onClose: () => void;
};

export function PostOverlayModal({ post, onClose }: PostOverlayModalProps) {
  useEffect(() => {
    if (!post) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [post]);

  useEffect(() => {
    if (!post) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, post]);

  return (
    <AnimatePresence>
      {post ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            aria-label="Cerrar publicación"
            className="absolute inset-0 h-full w-full bg-black/65 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-3 sm:p-6">
            <motion.article
              role="dialog"
              aria-modal="true"
              className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-tonki-border bg-tonki-canvas shadow-2xl"
              initial={{ y: 28, opacity: 0, scale: 0.985 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.99 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <header className="flex items-start justify-between gap-3 border-b border-tonki-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-tonki-text">
                    {post.author.name}
                  </p>
                  <time
                    className="text-xs text-tonki-text-muted"
                    dateTime={post.updated_at}
                  >
                    {new Date(post.updated_at).toLocaleString("es", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-2 py-1 text-sm text-tonki-text-muted transition hover:bg-tonki-surface hover:text-tonki-text"
                >
                  Cerrar
                </button>
              </header>

              <div className="max-h-[85vh] overflow-y-auto px-4 py-4 sm:px-5">
                <h3 className="text-xl font-semibold text-tonki-text">{post.title}</h3>
                {post.body?.trim() ? (
                  <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-tonki-text-secondary">
                    {post.body}
                  </p>
                ) : null}

                {filterImageAttachments(post.attachments).length > 0 ? (
                  <div className="mt-4">
                    <ImageAttachmentGrid
                      items={filterImageAttachments(post.attachments).map((a) => ({
                        key: a.attachment_id,
                        src: a.url,
                        alt: a.original_name?.trim() ?? "",
                      }))}
                    />
                  </div>
                ) : null}

                {filterVideoAttachments(post.attachments).length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-3">
                    {filterVideoAttachments(post.attachments).map((v) => (
                      <li
                        key={v.attachment_id}
                        className="overflow-hidden rounded-2xl border border-tonki-border bg-black"
                      >
                        <video
                          className="max-h-[min(70vh,520px)] w-full object-contain"
                          controls
                          playsInline
                          preload="metadata"
                          src={v.url}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}

                {nonImageNonVideoAttachments(post).length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-2">
                    {nonImageNonVideoAttachments(post).map((f) => (
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
                ) : null}
              </div>
            </motion.article>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
