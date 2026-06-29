"use client";
import { memo, Suspense, useCallback, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signMessage,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthResponse, UserRole } from "src/types/auth";

function sanitizeReturnPath(
  raw: string | null,
  role: UserRole
): string | null {
  if (!raw?.trim()) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  const pathOnly = decoded.split(/[?#]/, 1)[0] ?? "";
  if (
    pathOnly.startsWith("//") ||
    !pathOnly.startsWith("/") ||
    pathOnly === "/login"
  ) {
    return null;
  }
  if (/[\x00-\x1f]/.test(pathOnly)) return null;
  if (!/^\/[-\w./]*$/.test(pathOnly)) return null;

  if (pathOnly.startsWith("/admin")) {
    return role === "admin" ? pathOnly : null;
  }
  if (pathOnly.startsWith("/dashboard")) {
    return pathOnly;
  }
  if (pathOnly.startsWith("/account")) {
    return pathOnly;
  }
  return null;
}

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_oauth_not_configured:
    "El inicio de sesión con Gmail no está disponible por ahora.",
  google_access_denied: "Cancelaste el acceso con Gmail.",
  google_oauth_invalid_callback:
    "No se pudo completar el inicio de sesión con Gmail. Intenta de nuevo.",
  google_oauth_state_mismatch:
    "La sesión de Gmail expiró. Vuelve a intentarlo.",
  google_oauth_failed:
    "No se pudo iniciar sesión con Gmail. Intenta de nuevo.",
  google_oauth_infrastructure_error:
    "Tuvimos un problema técnico con Gmail. Intenta más tarde.",
  account_suspended: "Tu cuenta está suspendida. Contacta a soporte.",
  invalid_account_role: "No pudimos validar tu cuenta. Contacta a soporte.",
  auth_secret_missing:
    "Configuración de seguridad incompleta. Contacta a soporte.",
};

function resolveQueryError(code: string | null): string {
  if (!code) return "";
  return GOOGLE_ERROR_MESSAGES[code] ?? "No se pudo iniciar sesión.";
}

function buildGoogleStartUrl(from: string | null): string {
  const params = new URLSearchParams();
  if (from?.trim()) params.set("from", from);
  const query = params.toString();
  return query ? `/api/auth/google/start?${query}` : "/api/auth/google/start";
}

type LoginState = {
  username: string;
  password: string;
  error: string;
  isSubmitting: boolean;
  isWalletLoading: boolean;
  isGoogleLoading: boolean;
};

type LoginAction =
  | { type: "SET_USERNAME"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_WALLET_LOADING"; payload: boolean }
  | { type: "SET_GOOGLE_LOADING"; payload: boolean };

const initialState: LoginState = {
  username: "",
  password: "",
  error: "",
  isSubmitting: false,
  isWalletLoading: false,
  isGoogleLoading: false,
};

function loginReducer(state: LoginState, action: LoginAction): LoginState {
  switch (action.type) {
    case "SET_USERNAME":
      return { ...state, username: action.payload };
    case "SET_PASSWORD":
      return { ...state, password: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload };
    case "SET_WALLET_LOADING":
      return { ...state, isWalletLoading: action.payload };
    case "SET_GOOGLE_LOADING":
      return { ...state, isGoogleLoading: action.payload };
    default:
      return state;
  }
}

const GoogleIcon = memo(function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.46h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.28a12 12 0 0 0 0 10.78l4.01-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.17 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.09C6.23 6.86 8.88 4.75 12 4.75Z"
      />
    </svg>
  );
});

type GoogleButtonProps = {
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
};

const GoogleButton = memo(function GoogleButton({
  isLoading,
  disabled,
  onClick,
}: GoogleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-[#1f1f1f] shadow-sm transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <GoogleIcon />
      {isLoading ? "Conectando con Gmail…" : "Continuar con Gmail"}
    </button>
  );
});

type LoginFormProps = {
  username: string;
  password: string;
  isSubmitting: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

const LoginForm = memo(function LoginForm({
  username,
  password,
  isSubmitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <input
        type="text"
        placeholder="Usuario o correo"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-3 text-tonki-text placeholder:text-tonki-text-faint transition-colors focus:border-tonki-accent focus:outline-none"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-3 text-tonki-text placeholder:text-tonki-text-faint transition-colors focus:border-tonki-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 rounded-xl bg-tonki-accent px-4 py-3 font-semibold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
});

type WalletButtonProps = {
  isLoading: boolean;
  onClick: () => void;
};

const WalletButton = memo(function WalletButton({
  isLoading,
  onClick,
}: WalletButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="rounded-xl border border-tonki-accent px-4 py-3 font-semibold text-tonki-accent transition-colors hover:bg-tonki-accent hover:text-tonki-accent-fg disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "Conectando..." : "Conectar Wallet (Freighter)"}
    </button>
  );
});

function LoginPageInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const [state, dispatch] = useReducer(loginReducer, initialState, (base) => ({
    ...base,
    error: resolveQueryError(searchParams.get("error")),
  }));
  const router = useRouter();

  const redirectAfterAuth = useCallback(
    (data: AuthResponse) => {
      const target = sanitizeReturnPath(from, data.role);
      router.push(target ?? data.redirectTo);
    },
    [from, router]
  );

  const handleLoginSuccess = useCallback(
    (data: AuthResponse) => {
      redirectAfterAuth(data);
    },
    [redirectAfterAuth]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ type: "SET_ERROR", payload: "" });
      dispatch({ type: "SET_SUBMITTING", payload: true });

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: state.username,
            password: state.password,
          }),
        });

        type LoginApiBody = AuthResponse & { error?: string };

        const data = await readJsonSafely<LoginApiBody>(res);
        if (data === null) {
          dispatch({
            type: "SET_ERROR",
            payload: "Respuesta inválida del servidor",
          });
          return;
        }
        if (res.ok) {
          handleLoginSuccess(data);
          return;
        }

        dispatch({
          type: "SET_ERROR",
          payload: data.error || "Error en inicio de sesión",
        });
      } catch (err) {
        console.error(err);
        dispatch({
          type: "SET_ERROR",
          payload: "No se pudo iniciar sesión",
        });
      } finally {
        dispatch({ type: "SET_SUBMITTING", payload: false });
      }
    },
    [handleLoginSuccess, state.password, state.username]
  );

  const handleWalletLogin = useCallback(async () => {
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_WALLET_LOADING", payload: true });
    try {
      const isAppConnected = await isConnected();

      if (!isAppConnected.isConnected) {
        dispatch({
          type: "SET_ERROR",
          payload: "Freighter no está disponible. Instala la extensión.",
        });
        return;
      }

      const accessRes = await requestAccess();
      if (accessRes.error) {
        dispatch({
          type: "SET_ERROR",
          payload: "Acceso denegado. Aprueba la conexión en Freighter.",
        });
        return;
      }
      const publicKey = accessRes.address;

      const challengeRes = await fetch("/api/auth/wallet-challenge", {
        credentials: "include",
      });
      const challengeBody = await readJsonSafely<{
        success?: boolean;
        message?: string;
        error?: string;
      }>(challengeRes);

      if (!challengeRes.ok || !challengeBody?.success || !challengeBody.message) {
        dispatch({
          type: "SET_ERROR",
          payload:
            challengeBody?.error ??
            "No se pudo obtener el reto de seguridad para la wallet.",
        });
        return;
      }

      const signRes = await signMessage(challengeBody.message, {
        address: publicKey,
      });
      if (signRes.error) {
        dispatch({
          type: "SET_ERROR",
          payload: "No se pudo firmar el mensaje. Intenta de nuevo.",
        });
        return;
      }

      const signature = signRes.signedMessage;

      const res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, signature }),
      });

      type WalletLoginApiBody = AuthResponse & { error?: string };

      const data = await readJsonSafely<WalletLoginApiBody>(res);
      if (data === null) {
        dispatch({
          type: "SET_ERROR",
          payload: "Respuesta inválida del servidor",
        });
        return;
      }
      if (res.ok) {
        handleLoginSuccess(data);
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: data.error || "Error en login con wallet",
        });
      }
    } catch (err) {
      console.error(err);
      dispatch({
        type: "SET_ERROR",
        payload: "No se pudo conectar la wallet",
      });
    } finally {
      dispatch({ type: "SET_WALLET_LOADING", payload: false });
    }
  }, [handleLoginSuccess]);

  const handleGoogleLogin = useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_GOOGLE_LOADING", payload: true });
    window.location.assign(buildGoogleStartUrl(from));
  }, [from]);

  const handleUsernameChange = useCallback((value: string) => {
    dispatch({ type: "SET_USERNAME", payload: value });
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    dispatch({ type: "SET_PASSWORD", payload: value });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-tonki-canvas px-4">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-8 rounded-2xl border border-tonki-border bg-tonki-surface p-8 shadow-2xl shadow-black/40">
        {/* Logo / Título */}
        <div className="mb-0 flex flex-col items-center gap-2">
          <span className="text-3xl font-bold tracking-tight text-tonki-accent sm:text-4xl">
            TonkiApp
          </span>
          <p className="text-center text-sm text-tonki-text-muted">
            Crea tu wallet en segundos con tu cuenta de Gmail
          </p>
        </div>

        <GoogleButton
          onClick={handleGoogleLogin}
          isLoading={state.isGoogleLoading}
          disabled={state.isGoogleLoading || state.isSubmitting}
        />

        {/* Separador */}
        <div className="flex items-center gap-4">
          <hr className="flex-1 border-tonki-border" />
          <span className="text-xs font-medium uppercase tracking-wider text-tonki-text-faint">
            o usa tu cuenta
          </span>
          <hr className="flex-1 border-tonki-border" />
        </div>

        <LoginForm
          username={state.username}
          password={state.password}
          isSubmitting={state.isSubmitting}
          onUsernameChange={handleUsernameChange}
          onPasswordChange={handlePasswordChange}
          onSubmit={handleSubmit}
        />

        {/* Error */}
        {state.error && (
          <p className="text-center text-sm text-tonki-danger">{state.error}</p>
        )}

        {/* Opciones avanzadas */}
        <details className="group text-center">
          <summary className="cursor-pointer list-none text-xs font-medium text-tonki-text-faint transition-colors hover:text-tonki-text-muted">
            Opciones avanzadas
          </summary>
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-xs text-tonki-text-faint">
              ¿Ya tienes una wallet de Stellar? Conéctala con Freighter.
            </p>
            <WalletButton
              onClick={handleWalletLogin}
              isLoading={state.isWalletLoading}
            />
          </div>
        </details>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-tonki-canvas">
          <p className="text-sm text-tonki-text-muted">Cargando…</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
