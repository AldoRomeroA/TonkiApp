"use client";

import { FallbackNextImage } from "src/components/FallbackNextImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload } from "src/types/auth";
import {
  AccountSlideOverGroup,
  AccountSlideOverTrigger,
  useOpenAccountPanel,
} from "src/components/AccountSlideOver";

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
      <div className="flex min-h-screen items-center justify-center bg-tonki-canvas text-sm text-tonki-text-muted">
        Comprobando permisos…
      </div>
    );
  }

  return (
    <AccountSlideOverGroup>
      <div className="min-h-screen bg-tonki-canvas text-tonki-text">
        <header className="sticky top-0 z-40 border-b border-tonki-chrome-border bg-tonki-chrome/95 backdrop-blur-md">
          <div className="mx-auto grid w-full max-w-[600px] grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:px-5">
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2.5 justify-self-start text-tonki-chrome-text transition-colors hover:text-tonki-accent"
            >
              <FallbackNextImage src="/logo.png" alt="Tonki" width={28} height={28} priority />
              <span className="hidden text-base font-bold tracking-tight sm:inline">
                Tonki
              </span>
            </Link>
            <h1 className="max-w-[min(260px,calc(100vw-9rem))] justify-self-center text-center text-[15px] font-bold leading-snug text-tonki-chrome-text sm:max-w-xs sm:text-[17px]">
              Centro admin
            </h1>
            <AccountSlideOverTrigger className="justify-self-end truncate text-sm text-tonki-chrome-text-muted transition-colors hover:text-tonki-chrome-text-secondary sm:max-w-[min(140px,calc((100vw-10rem)/2))] sm:text-base" />
          </div>

          <div className="mx-auto grid w-full max-w-[600px] grid-cols-3 border-y border-tonki-chrome-border">
            {tabs("compose", "Nuevo post")}
            {tabs("mine", "Mis publicaciones")}
            {tabs("metrics", "Métricas")}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[600px] pb-24">
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

        <nav className="fixed bottom-4 left-4 right-4 z-30 mx-auto flex w-[min(560px,calc(100%-2rem))] justify-center gap-8 rounded-full border border-tonki-chrome-border bg-tonki-chrome/95 px-6 py-3 text-sm font-medium text-tonki-chrome-text-muted shadow-lg shadow-black/20 backdrop-blur-md md:hidden">
          <Link
            href="/"
            className="transition-colors hover:text-tonki-chrome-text-secondary"
          >
            Tonki
          </Link>
          <Link
            href="/dashboard"
            className="transition-colors hover:text-tonki-chrome-text-secondary"
          >
            Feed
          </Link>
          <AccountSlideOverTrigger className="max-w-[5.5rem] truncate transition-colors hover:text-tonki-chrome-text-secondary" />
        </nav>
      </div>
    </AccountSlideOverGroup>
  );
}
