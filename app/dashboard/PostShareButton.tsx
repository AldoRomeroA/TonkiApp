"use client";

import { useCallback, useState } from "react";

type PostShareButtonProps = {
  postId: string;
  title: string;
};

async function copyText(text: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below for insecure context / denied clipboard permission.
    }
  }

  const temp = document.createElement("textarea");
  temp.value = text;
  temp.setAttribute("readonly", "");
  temp.style.position = "fixed";
  temp.style.top = "-9999px";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.focus();
  temp.select();

  try {
    const ok = document.execCommand("copy");
    document.body.removeChild(temp);
    return ok;
  } catch {
    document.body.removeChild(temp);
    return false;
  }
}

export function PostShareButton({ postId, title }: PostShareButtonProps) {
  const [hint, setHint] = useState<string | null>(null);

  const share = useCallback(async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/dashboard?post=${encodeURIComponent(postId)}`
        : "";

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Tonki",
          text: title.trim() || "Publicación en Tonki",
          url: shareUrl,
        });
        setHint(null);
        return;
      } catch (err) {
        const name = err instanceof Error ? err.name : "";
        if (name === "AbortError") return;
      }
    }

    const copied = await copyText(shareUrl);
    if (copied) {
      setHint("Enlace copiado");
      window.setTimeout(() => setHint(null), 2000);
    } else {
      setHint("No se pudo copiar");
      window.setTimeout(() => setHint(null), 2500);
    }
  }, [postId, title]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void share()}
        className="group inline-flex items-center gap-1.5 rounded-full p-1.5 text-tonki-text-muted transition hover:bg-tonki-accent/10 hover:text-tonki-accent"
        aria-label="Compartir publicación"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.75}
          stroke="currentColor"
          className="h-[18px] w-[18px]"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.284.696.284 1.093s-.103.77-.284 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186zm0-12.814a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186z"
          />
        </svg>
        <span className="text-sm font-medium tabular-nums">Compartir</span>
      </button>
      {hint ? (
        <span
          className="text-xs font-medium text-tonki-accent"
          role="status"
          aria-live="polite"
        >
          {hint}
        </span>
      ) : null}
    </div>
  );
}
