"use client";

import { useCallback, useEffect, useState } from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { UserRole } from "src/types/auth";

import { PostComposerForm } from "./PostComposerForm";

type FeedComposerProps = {
  onPublished: () => void;
};

export function FeedComposer({ onPublished }: FeedComposerProps) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await readJsonSafely<{
          success?: boolean;
          role?: UserRole;
        }>(res);
        if (cancelled) return;
        if (res.ok && data?.success === true && data.role) {
          setRole(data.role);
        } else {
          setRole(null);
        }
      } catch {
        if (!cancelled) setRole(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePublished = useCallback(() => {
    onPublished();
  }, [onPublished]);

  if (!ready || role !== "admin") {
    return null;
  }

  return (
    <div className="border-b border-tonki-border bg-tonki-surface px-4 py-4 sm:px-5">
      <PostComposerForm
        className="flex flex-col gap-4"
        onPublished={handlePublished}
      />
    </div>
  );
}
