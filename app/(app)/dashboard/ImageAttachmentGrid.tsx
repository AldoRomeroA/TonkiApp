"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { FallbackImage } from "src/components/FallbackImage";

export type ImageAttachmentGridItem = {
  key: string;
  src: string;
  alt?: string;
};

type ImageAttachmentGridProps = {
  items: ImageAttachmentGridItem[];
  overlay?: (item: ImageAttachmentGridItem, index: number) => ReactNode;
  className?: string;
  /** Clases extra por celda (p. ej. opacidad al marcar borrado en edición). */
  getItemLiClassName?: (index: number) => string | undefined;
};

export function ImageAttachmentGrid({
  items,
  overlay,
  className,
  getItemLiClassName,
}: ImageAttachmentGridProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);

  const goPrev = useCallback(() => {
    setOpenIdx((i) =>
      i === null || items.length <= 1 ? i : (i + items.length - 1) % items.length
    );
  }, [items.length]);

  const goNext = useCallback(() => {
    setOpenIdx((i) =>
      i === null || items.length <= 1 ? i : (i + 1) % items.length
    );
  }, [items.length]);

  useEffect(() => {
    if (openIdx === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [openIdx]);

  useEffect(() => {
    if (openIdx !== null && closeBtnRef.current) {
      closeBtnRef.current.focus();
    }
  }, [openIdx]);

  useEffect(() => {
    if (openIdx === null) return;
    const onWin = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (items.length > 1 && e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
      if (items.length > 1 && e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onWin);
    return () => window.removeEventListener("keydown", onWin);
  }, [openIdx, close, goNext, goPrev, items.length]);

  if (items.length === 0) return null;

  return (
    <>
      <ul
        className={
          className ??
          "m-0 grid w-full list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4"
        }
      >
        {items.map((item, index) => (
          <li
            key={item.key}
            className={[
              "relative min-h-0 min-w-0 w-full isolate",
              getItemLiClassName?.(index) ?? "",
            ]
              .join(" ")
              .trim()}
          >
            <button
              type="button"
              aria-label={`Ampliar imagen ${index + 1}${item.alt ? `: ${item.alt}` : ""}`}
              className="group/thumb relative block aspect-square w-full overflow-hidden rounded-2xl border border-tonki-border bg-tonki-surface outline-none ring-offset-2 ring-offset-tonki-canvas focus-visible:ring-2 focus-visible:ring-tonki-accent"
              onClick={() => setOpenIdx(index)}
            >
              <FallbackImage
                src={item.src}
                alt={item.alt ?? ""}
                className="pointer-events-none h-full w-full object-cover transition group-hover/thumb:opacity-95"
                loading="lazy"
                decoding="async"
              />
            </button>
            {overlay?.(item, index)}
          </li>
        ))}
      </ul>

      {openIdx !== null && items[openIdx] !== undefined ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-tonki-surface/98 p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Imagen completa"
        >
          <div className="flex shrink-0 justify-end pb-4">
            <button
              ref={closeBtnRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              className="rounded-full border border-tonki-border px-5 py-2 text-sm font-semibold text-tonki-text-secondary outline-none transition-colors hover:bg-tonki-elevated focus-visible:ring-2 focus-visible:ring-tonki-accent"
            >
              Cerrar
            </button>
          </div>

          <div
            role="presentation"
            className="flex min-h-0 flex-1 items-center justify-center gap-4"
            onClick={close}
          >
            {items.length > 1 ? (
              <button
                type="button"
                aria-label="Imagen anterior"
                className="hidden shrink-0 rounded-full border border-tonki-border px-4 py-3 text-xl text-tonki-text-secondary transition-colors hover:bg-tonki-elevated sm:inline"
                onClick={(e) => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                ‹
              </button>
            ) : null}

            <FallbackImage
              src={items[openIdx].src}
              alt={items[openIdx].alt ?? "Publicación"}
              className="max-h-[min(92dvh,calc(100vh-140px))] max-w-[min(100%,96vw)] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {items.length > 1 ? (
              <button
                type="button"
                aria-label="Imagen siguiente"
                className="hidden shrink-0 rounded-full border border-tonki-border px-4 py-3 text-xl text-tonki-text-secondary transition-colors hover:bg-tonki-elevated sm:inline"
                onClick={(e) => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                ›
              </button>
            ) : null}
          </div>

          <p className="shrink-0 pt-3 text-center text-xs text-tonki-text-muted">
            {(openIdx ?? 0) + 1} / {items.length}{" "}
            <span className="hidden sm:inline">
              · cerrar (Esc) · anterior/siguiente (← →)
            </span>
          </p>
        </div>
      ) : null}
    </>
  );
}
