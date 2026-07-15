"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload, PublicUser, UserRole } from "src/types/auth";

type ApiEnvelope =
  | (AuthMePayload & { success: true })
  | { success: false; error?: string };

type ProfileFormState = {
  email: string;
  first_name: string;
  paternal_surname: string;
  maternal_surname: string;
  birthDate: string;
};

const FIELD =
  "w-full rounded-xl border border-tonki-border bg-tonki-surface px-4 py-3 text-tonki-text outline-none transition-colors focus:border-tonki-accent";

function formFromUser(user: PublicUser): ProfileFormState {
  return {
    email: user.email ?? "",
    first_name: user.first_name ?? "",
    paternal_surname: user.paternal_surname ?? "",
    maternal_surname: user.maternal_surname ?? "",
    birthDate: user.birth_date ?? "",
  };
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 20) return wallet;
  return `${wallet.slice(0, 10)}…${wallet.slice(-8)}`;
}

export default function AccountPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>("user");
  const [user, setUser] = useState<PublicUser | null>(null);
  const [form, setForm] = useState<ProfileFormState>({
    email: "",
    first_name: "",
    paternal_surname: "",
    maternal_surname: "",
    birthDate: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setUser(data.user);
      setRole(data.role);
      setForm(formFromUser(data.user));
      setAvatarPreview(data.user.avatar_url);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (avatarPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const handleAvatarChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      if (!file) return;
      setAvatarFile(file);
      setAvatarPreview((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      setError(null);
      setSuccess(null);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);
      setSaving(true);

      try {
        const body = new FormData();
        body.set("email", form.email);
        body.set("first_name", form.first_name);
        body.set("paternal_surname", form.paternal_surname);
        body.set("maternal_surname", form.maternal_surname);
        body.set("birthDate", form.birthDate);
        if (avatarFile) {
          body.set("avatar", avatarFile);
        }

        const res = await fetch("/api/auth/profile", {
          method: "PATCH",
          credentials: "include",
          body,
        });
        const data = await readJsonSafely<
          | (AuthMePayload & { success: true; message?: string })
          | { success: false; error?: string }
        >(res);

        if (!res.ok || !data?.success) {
          setError(
            data && "error" in data && data.error
              ? data.error
              : "No se pudo guardar el perfil"
          );
          return;
        }

        setUser(data.user);
        setRole(data.role);
        setForm(formFromUser(data.user));
        setAvatarFile(null);
        setAvatarPreview(data.user.avatar_url);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess(data.message ?? "Perfil actualizado");
      } catch {
        setError("No se pudo guardar el perfil");
      } finally {
        setSaving(false);
      }
    },
    [avatarFile, form]
  );

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

  if (loading || !user) {
    return (
      <main className="mx-auto flex w-full items-center justify-center px-4 py-16 text-sm text-tonki-text-muted">
        Cargando perfil…
      </main>
    );
  }

  const wallet = user.wallet_address?.trim() || null;

  return (
    <main className="mx-auto w-full px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-bold tracking-tight text-tonki-text sm:text-3xl">
        Tu perfil
      </h1>
      <p className="mt-2 text-sm text-tonki-text-muted sm:text-base">
        Actualiza tus datos personales.
      </p>

      <section className="mt-8 space-y-6 rounded-2xl border border-tonki-border bg-tonki-surface p-6 shadow-sm sm:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-tonki-text-faint">
            Rol
          </p>
          <p className="mt-2 text-base text-tonki-text-secondary">
            {role === "admin" ? "Administrador" : "Usuario"}
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-tonki-danger"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            className="rounded-xl border border-tonki-accent/40 bg-tonki-accent/10 px-4 py-3 text-sm font-medium text-tonki-text"
          >
            {success}
          </p>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-tonki-border bg-tonki-canvas text-sm font-semibold text-tonki-text-muted">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              ) : (
                "Sin foto"
              )}
            </div>
            <div>
              <label
                htmlFor="avatar"
                className="mb-1.5 block text-sm font-medium text-tonki-text"
              >
                Foto de perfil
              </label>
              <input
                ref={fileInputRef}
                id="avatar"
                name="avatar"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="block w-full text-sm text-tonki-text-secondary file:mr-3 file:rounded-xl file:border-0 file:bg-tonki-accent file:px-3 file:py-2 file:text-sm file:font-semibold file:text-tonki-accent-fg"
              />
              <p className="mt-1 text-xs text-tonki-text-faint">
                JPG, PNG, GIF o WebP · máx. 2 MB
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className={role === "admin" ? "sm:col-span-3" : undefined}>
              <label
                htmlFor="first_name"
                className="mb-1.5 block text-sm font-medium text-tonki-text"
              >
                Nombre
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                required
                maxLength={50}
                autoComplete="given-name"
                value={form.first_name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, first_name: e.target.value }))
                }
                className={FIELD}
              />
            </div>
            {role !== "admin" ? (
              <>
                <div>
                  <label
                    htmlFor="paternal_surname"
                    className="mb-1.5 block text-sm font-medium text-tonki-text"
                  >
                    Apellido Paterno
                  </label>
                  <input
                    id="paternal_surname"
                    name="paternal_surname"
                    type="text"
                    maxLength={50}
                    autoComplete="family-name"
                    value={form.paternal_surname}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        paternal_surname: e.target.value,
                      }))
                    }
                    className={FIELD}
                  />
                </div>
                <div>
                  <label
                    htmlFor="maternal_surname"
                    className="mb-1.5 block text-sm font-medium text-tonki-text"
                  >
                    Apellido Materno
                  </label>
                  <input
                    id="maternal_surname"
                    name="maternal_surname"
                    type="text"
                    maxLength={50}
                    value={form.maternal_surname}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        maternal_surname: e.target.value,
                      }))
                    }
                    className={FIELD}
                  />
                </div>
              </>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-tonki-text"
            >
              Correo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              maxLength={100}
              autoComplete="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              className={FIELD}
            />
          </div>

          <div>
            <label
              htmlFor="birthDate"
              className="mb-1.5 block text-sm font-medium text-tonki-text"
            >
              Fecha de nacimiento
            </label>
            <input
              id="birthDate"
              name="birthDate"
              type="date"
              required
              value={form.birthDate}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, birthDate: e.target.value }))
              }
              className={FIELD}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-tonki-text">Wallet</p>
            <p className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-3 font-mono text-sm text-tonki-text-secondary">
              {wallet ? truncateWallet(wallet) : "Sin wallet"}
            </p>
            {wallet ? (
              <p className="mt-1 break-all text-xs text-tonki-text-faint">
                {wallet}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-tonki-accent px-4 py-3 text-base font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>

        <div className="space-y-3 border-t border-tonki-border pt-6">
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
            className="block w-full rounded-xl border border-tonki-border px-4 py-3 text-center text-base font-semibold text-tonki-text transition-colors hover:bg-tonki-elevated"
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
        </div>
      </section>
    </main>
  );
}
