"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload } from "src/types/auth";

type ApiEnvelope =
  | (AuthMePayload & { success: true })
  | { success: false; error?: string };

type AccountPanelContextValue = {
  openPanel: () => void;
  /** Etiqueta para el botón con el nombre de usuario */
  triggerLabel: string;
  triggerLoading: boolean;
};

const AccountPanelContext = createContext<AccountPanelContextValue | null>(
  null
);

function useAccountPanel(): AccountPanelContextValue {
  const ctx = useContext(AccountPanelContext);
  if (!ctx) {
    throw new Error(
      "El panel de cuenta debe usarse dentro de AccountSlideOverGroup"
    );
  }
  return ctx;
}

export function useOpenAccountPanel(): () => void {
  return useAccountPanel().openPanel;
}

type AccountSlideOverGroupProps = {
  children: ReactNode;
};

export function AccountSlideOverGroup({ children }: AccountSlideOverGroupProps) {
  const router = useRouter();
  const titleId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [payload, setPayload] = useState<AuthMePayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const openPanel = useCallback(() => setOpen(true), []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await readJsonSafely<ApiEnvelope>(res);
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setLoadError(true);
          setPayload(null);
        } else {
          setLoadError(false);
          setPayload({ user: data.user, role: data.role });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

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

  const display =
    payload?.user != null
      ? (payload.user.username ??
        payload.user.email ??
        (payload.user.id ? `${payload.user.id.slice(0, 8)}…` : "—"))
      : null;

  const triggerLabel = loading
    ? ""
    : loadError
      ? "Cuenta"
      : (display ?? "Cuenta");

  const contextValue = useMemo<AccountPanelContextValue>(
    () => ({
      openPanel,
      triggerLabel,
      triggerLoading: loading,
    }),
    [openPanel, triggerLabel, loading]
  );

  return (
    <AccountPanelContext.Provider value={contextValue}>
      {children}

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              aria-label="Cerrar panel de cuenta"
              className="absolute inset-0 h-full w-full bg-tonki-chrome/55 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            <motion.aside
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-tonki-border bg-tonki-surface shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            >
              <header className="flex items-center justify-between gap-3 border-b border-tonki-border px-5 py-4">
                <h2
                  id={titleId}
                  className="text-lg font-bold tracking-tight text-tonki-text"
                >
                  Tu cuenta
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-tonki-text-muted transition-colors hover:bg-tonki-surface hover:text-tonki-text"
                >
                  Cerrar
                </button>
              </header>

              <div className="flex flex-1 flex-col overflow-y-auto px-5 py-6">
                {loading ? (
                  <p className="text-sm text-tonki-text-muted">
                    Cargando datos…
                  </p>
                ) : loadError || !payload ? (
                  <p className="text-sm text-tonki-text-muted">
                    No se pudo cargar la sesión.{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-tonki-accent underline-offset-2 hover:underline"
                    >
                      Iniciar sesión
                    </Link>
                  </p>
                ) : (
                  <section className="space-y-6 rounded-2xl border border-tonki-border bg-tonki-canvas p-5 sm:p-6">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-tonki-text-faint">
                        Cuenta
                      </p>
                      <p className="mt-2 text-lg font-semibold text-tonki-text">
                        {display}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-tonki-text-faint">
                        Rol
                      </p>
                      <p className="mt-2 text-base text-tonki-text-secondary">
                        {payload.role === "admin" ? "Administrador" : "Usuario"}
                      </p>
                    </div>

                    {payload.role === "admin" && (
                      <Link
                        href="/admin/dashboard"
                        onClick={() => setOpen(false)}
                        className="block w-full rounded-xl border border-tonki-border px-4 py-3 text-center text-base font-semibold text-tonki-accent transition-colors hover:bg-tonki-elevated"
                      >
                        Panel admin · contenido
                      </Link>
                    )}

                    <Link
                      href="/dashboard"
                      onClick={() => setOpen(false)}
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
                )}
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AccountPanelContext.Provider>
  );
}

type AccountSlideOverTriggerProps = {
  className?: string;
  /** Texto mientras carga GET /api/auth/me */
  loadingLabel?: string;
};

export function AccountSlideOverTrigger({
  className,
  loadingLabel = "…",
}: AccountSlideOverTriggerProps) {
  const { openPanel, triggerLabel, triggerLoading } = useAccountPanel();

  const label = triggerLoading ? loadingLabel : triggerLabel;

  return (
    <button
      type="button"
      onClick={() => openPanel()}
      className={className}
      aria-haspopup="dialog"
    >
      {label}
    </button>
  );
}
