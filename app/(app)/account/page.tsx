"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload } from "src/types/auth";

type ApiEnvelope =
  | (AuthMePayload & { success: true })
  | { success: false; error?: string };

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<AuthMePayload | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      const data = await readJsonSafely<ApiEnvelope>(res);
      if (cancelled) return;
      if (!res.ok || !data?.success) {
        router.replace(`/login?from=${encodeURIComponent("/account")}`);
        return;
      }
      setPayload({ user: data.user, role: data.role });
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = useCallback(async () => {
    setLogoutBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      router.replace("/login");
      router.refresh();
    } catch {
      setLogoutBusy(false);
    }
  }, [router]);

  if (loading || !payload) {
    return (
      <main className="mx-auto flex w-full items-center justify-center px-4 py-16 text-sm text-tonki-text-muted">
        Cargando perfil…
      </main>
    );
  }

  const { user, role } = payload;
  const display =
    user.username ?? user.email ?? (user.id ? `${user.id.slice(0, 8)}…` : "—");

  return (
    <main className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-tonki-text sm:text-3xl">
        Tu perfil
      </h1>
      <p className="mt-2 text-sm text-tonki-text-muted sm:text-base">
        Gestiona sesión y accesos rápidos.
      </p>

      <section className="mt-8 space-y-6 rounded-2xl border border-tonki-border bg-tonki-surface p-6 shadow-sm sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-tonki-text-faint">
              Cuenta
            </p>
            <p className="mt-2 text-lg font-semibold text-tonki-text sm:text-xl">
              {display}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-tonki-text-faint">
              Rol
            </p>
            <p className="mt-2 text-base text-tonki-text-secondary">
              {role === "admin" ? "Administrador" : "Usuario"}
            </p>
          </div>

          {role === "admin" && (
            <Link
              href="/admin/dashboard"
              className="block w-full rounded-xl border border-tonki-border px-4 py-3 text-center text-base font-semibold text-tonki-accent transition-colors hover:bg-tonki-elevated"
            >
              Panel admin · contenido
            </Link>
          )}

          <Link
            href="/dashboard"
            className="block w-full rounded-xl bg-tonki-accent px-4 py-3 text-center text-base font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
          >
            Ver feed
          </Link>

          <button
            type="button"
            disabled={logoutBusy}
            onClick={() => void handleLogout()}
            className="w-full rounded-xl border border-red-200 bg-transparent px-4 py-3 text-base font-semibold text-tonki-danger transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            {logoutBusy ? "Cerrando…" : "Cerrar sesión"}
          </button>
      </section>
    </main>
  );
}
