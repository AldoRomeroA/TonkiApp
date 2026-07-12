"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload } from "src/types/auth";
import { useOpenAccountPanel } from "src/components/AccountSlideOver";

import { AdminComposerTab } from "./AdminComposerTab";
import { AdminMetricsTab } from "./AdminMetricsTab";
import { AdminMyPostsTab } from "./AdminMyPostsTab";

type ApiEnvelope =
  | (AuthMePayload & { success: true })
  | { success: false; error?: string };

type AdminTab = "compose" | "mine" | "metrics";

function SessionAdminLine({ label }: { label: string }) {
  const openAccount = useOpenAccountPanel();

  return (
    <button
      type="button"
      onClick={() => openAccount()}
      className="w-full border-x border-transparent px-4 py-3 text-left text-xs text-tonki-text-faint transition-colors hover:text-tonki-text-secondary sm:text-sm"
    >
      {label}
    </button>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [gatePending, setGatePending] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [tab, setTab] = useState<AdminTab>("compose");

  useEffect(() => {
    let cancelled = false;
    async function gate() {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await readJsonSafely<ApiEnvelope>(res);
      if (cancelled) return;

      if (!res.ok || !data?.success) {
        router.replace("/login");
        return;
      }

      if (data.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      const label =
        data.user.username ??
        data.user.email ??
        (data.user.id ? `${data.user.id.slice(0, 8)}…` : "");

      setDisplayName(label ? `Sesión admin · ${label}` : "Sesión admin");
      setGatePending(false);
    }
    void gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const tabs = useCallback(
    (id: AdminTab, label: string) => (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={tab === id}
        onClick={() => setTab(id)}
        className={`relative flex min-h-[52px] flex-1 justify-center px-6 text-sm font-semibold transition-colors hover:bg-tonki-chrome-hover/50 sm:text-base ${
          tab === id
            ? "text-tonki-chrome-text"
            : "text-tonki-chrome-text-muted hover:text-tonki-chrome-text-secondary"
        }`}
      >
        {label}
        {tab === id && (
          <span className="absolute bottom-0 left-0 right-0 mx-auto h-1 w-16 rounded-full bg-tonki-accent" />
        )}
      </button>
    ),
    [tab]
  );

  if (gatePending) {
    return (
      <div className="flex items-center justify-center px-4 py-16 text-sm text-tonki-text-muted">
        Comprobando permisos…
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-tonki-chrome-border bg-tonki-chrome/95">
        <h1 className="sr-only">Centro admin</h1>
        <div
          role="tablist"
          className="mx-auto grid w-full grid-cols-3 border-t border-tonki-chrome-border"
        >
          {tabs("compose", "Nuevo post")}
          {tabs("mine", "Mis publicaciones")}
          {tabs("metrics", "Métricas")}
        </div>
      </div>

      <main className="mx-auto w-full pb-4">
        <SessionAdminLine label={displayName} />

        <div role="tabpanel">
          {tab === "compose" ? (
            <AdminComposerTab />
          ) : tab === "mine" ? (
            <AdminMyPostsTab />
          ) : (
            <AdminMetricsTab />
          )}
        </div>
      </main>
    </>
  );
}
