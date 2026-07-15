"use client";
import { memo, Suspense, useCallback, useReducer } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signMessage,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type {
  AuthResponse,
  UserRole,
  WalletNeedsRegistrationResponse,
} from "src/types/auth";
import "./login.css";

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
  google_token_exchange_failed:
    "Google rechazó el intercambio de token. Revisa GOOGLE_REDIRECT_URI en el servidor (debe ser exactamente https://tonki.io/api/auth/google/callback).",
  google_nonce_mismatch:
    "La verificación de Gmail falló (nonce). Vuelve a intentarlo.",
  google_id_token_invalid:
    "No se pudo validar la identidad de Google. Intenta de nuevo.",
  google_oauth_origin_misconfigured:
    "Falta APP_URL en el servidor (ej. https://tonki.io).",
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
  walletRegisterMode: boolean;
  pendingPublicKey: string;
  regName: string;
  regEmail: string;
  regBirthDate: string;
  isRegistering: boolean;
};

type LoginAction =
  | { type: "SET_USERNAME"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_WALLET_LOADING"; payload: boolean }
  | { type: "SET_GOOGLE_LOADING"; payload: boolean }
  | {
      type: "START_WALLET_REGISTER";
      payload: { publicKey: string };
    }
  | { type: "CANCEL_WALLET_REGISTER" }
  | { type: "SET_REG_NAME"; payload: string }
  | { type: "SET_REG_EMAIL"; payload: string }
  | { type: "SET_REG_BIRTH_DATE"; payload: string }
  | { type: "SET_REGISTERING"; payload: boolean };

const initialState: LoginState = {
  username: "",
  password: "",
  error: "",
  isSubmitting: false,
  isWalletLoading: false,
  isGoogleLoading: false,
  walletRegisterMode: false,
  pendingPublicKey: "",
  regName: "",
  regEmail: "",
  regBirthDate: "",
  isRegistering: false,
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
    case "START_WALLET_REGISTER":
      return {
        ...state,
        walletRegisterMode: true,
        pendingPublicKey: action.payload.publicKey,
        error: "",
        regName: "",
        regEmail: "",
        regBirthDate: "",
      };
    case "CANCEL_WALLET_REGISTER":
      return {
        ...state,
        walletRegisterMode: false,
        pendingPublicKey: "",
        regName: "",
        regEmail: "",
        regBirthDate: "",
        error: "",
      };
    case "SET_REG_NAME":
      return { ...state, regName: action.payload };
    case "SET_REG_EMAIL":
      return { ...state, regEmail: action.payload };
    case "SET_REG_BIRTH_DATE":
      return { ...state, regBirthDate: action.payload };
    case "SET_REGISTERING":
      return { ...state, isRegistering: action.payload };
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
      className="login-btn login-btn-outline login-btn-google"
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
    <form onSubmit={onSubmit} className="login-form">
      <input
        type="text"
        placeholder="Usuario o correo"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        className="login-input"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        className="login-input"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="login-btn login-btn-primary"
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
      className="login-btn login-btn-outline"
    >
      {isLoading ? "Conectando..." : "Conecta con Freighter"}
    </button>
  );
});

type WalletRegisterFormProps = {
  name: string;
  email: string;
  birthDate: string;
  publicKey: string;
  isSubmitting: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onBirthDateChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

const WalletRegisterForm = memo(function WalletRegisterForm({
  name,
  email,
  birthDate,
  publicKey,
  isSubmitting,
  onNameChange,
  onEmailChange,
  onBirthDateChange,
  onSubmit,
  onCancel,
}: WalletRegisterFormProps) {
  const shortKey =
    publicKey.length > 12
      ? `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`
      : publicKey;

  return (
    <form onSubmit={onSubmit} className="login-form">
      <p className="login-register-intro">
        Wallet verificada (<span className="login-mono">{shortKey}</span>).
        Completa tus datos para crear tu cuenta.
      </p>
      <input
        type="text"
        name="name"
        placeholder="Nombre (opcional)"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        className="login-input"
        autoComplete="name"
      />
      <input
        type="email"
        name="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        className="login-input"
        required
        autoComplete="email"
      />
      <label className="login-field-label" htmlFor="wallet-birth-date">
        Fecha de nacimiento
      </label>
      <input
        id="wallet-birth-date"
        type="date"
        name="birthDate"
        value={birthDate}
        onChange={(e) => onBirthDateChange(e.target.value)}
        className="login-input"
        required
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="login-btn login-btn-primary"
      >
        {isSubmitting ? "Registrando..." : "Crear cuenta"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isSubmitting}
        className="login-btn login-btn-outline"
      >
        Cancelar
      </button>
    </form>
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

      type WalletLoginApiBody = Partial<AuthResponse> &
        Partial<WalletNeedsRegistrationResponse> & {
          error?: string;
          success?: boolean;
        };

      const data = await readJsonSafely<WalletLoginApiBody>(res);
      if (data === null) {
        dispatch({
          type: "SET_ERROR",
          payload: "Respuesta inválida del servidor",
        });
        return;
      }
      if (!res.ok) {
        dispatch({
          type: "SET_ERROR",
          payload: data.error || "Error en login con wallet",
        });
        return;
      }

      if (data.needsRegistration && data.publicKey) {
        dispatch({
          type: "START_WALLET_REGISTER",
          payload: { publicKey: data.publicKey },
        });
        return;
      }

      if (data.user && data.role && data.redirectTo) {
        handleLoginSuccess({
          message: data.message ?? "Inicio de sesión exitoso",
          user: data.user,
          role: data.role,
          redirectTo: data.redirectTo,
        });
        return;
      }

      dispatch({
        type: "SET_ERROR",
        payload: "Respuesta inválida del servidor",
      });
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

  const handleWalletRegister = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ type: "SET_ERROR", payload: "" });
      dispatch({ type: "SET_REGISTERING", payload: true });
      try {
        const res = await fetch("/api/auth/wallet-register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.regEmail,
            birthDate: state.regBirthDate,
            ...(state.regName.trim() ? { name: state.regName.trim() } : {}),
          }),
        });

        type RegisterApiBody = AuthResponse & { error?: string };

        const data = await readJsonSafely<RegisterApiBody>(res);
        if (data === null) {
          dispatch({
            type: "SET_ERROR",
            payload: "Respuesta inválida del servidor",
          });
          return;
        }
        if (!res.ok) {
          dispatch({
            type: "SET_ERROR",
            payload: data.error || "No se pudo completar el registro",
          });
          if (res.status === 401) {
            dispatch({ type: "CANCEL_WALLET_REGISTER" });
          }
          return;
        }

        handleLoginSuccess(data);
      } catch (err) {
        console.error(err);
        dispatch({
          type: "SET_ERROR",
          payload: "No se pudo completar el registro",
        });
      } finally {
        dispatch({ type: "SET_REGISTERING", payload: false });
      }
    },
    [
      handleLoginSuccess,
      state.regBirthDate,
      state.regEmail,
      state.regName,
    ]
  );

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

  const handleRegNameChange = useCallback((value: string) => {
    dispatch({ type: "SET_REG_NAME", payload: value });
  }, []);

  const handleRegEmailChange = useCallback((value: string) => {
    dispatch({ type: "SET_REG_EMAIL", payload: value });
  }, []);

  const handleRegBirthDateChange = useCallback((value: string) => {
    dispatch({ type: "SET_REG_BIRTH_DATE", payload: value });
  }, []);

  const handleCancelWalletRegister = useCallback(() => {
    dispatch({ type: "CANCEL_WALLET_REGISTER" });
  }, []);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img
            src="/Logos-Tonki-SVG/Logo lateral caf-amarillo.svg"
            alt="Tonki"
            width={180}
            height={62}
            className="login-logo"
          />
        </div>

        {state.walletRegisterMode ? (
          <>
            <WalletRegisterForm
              name={state.regName}
              email={state.regEmail}
              birthDate={state.regBirthDate}
              publicKey={state.pendingPublicKey}
              isSubmitting={state.isRegistering}
              onNameChange={handleRegNameChange}
              onEmailChange={handleRegEmailChange}
              onBirthDateChange={handleRegBirthDateChange}
              onSubmit={handleWalletRegister}
              onCancel={handleCancelWalletRegister}
            />
            {state.error && <p className="login-error">{state.error}</p>}
          </>
        ) : (
          <>
            <LoginForm
              username={state.username}
              password={state.password}
              isSubmitting={state.isSubmitting}
              onUsernameChange={handleUsernameChange}
              onPasswordChange={handlePasswordChange}
              onSubmit={handleSubmit}
            />

            {state.error && <p className="login-error">{state.error}</p>}

            <div className="login-divider">
              <hr className="login-divider-line" />
              <span className="login-divider-label">Crea tu cuenta con Gmail</span>
              <hr className="login-divider-line" />
            </div>

            <GoogleButton
              onClick={handleGoogleLogin}
              isLoading={state.isGoogleLoading}
              disabled={
                state.isGoogleLoading ||
                state.isSubmitting ||
                state.isWalletLoading
              }
            />

            <div className="login-divider">
              <hr className="login-divider-line" />
              <span className="login-divider-label">¿Ya tienes Wallet?</span>
              <hr className="login-divider-line" />
            </div>

            <WalletButton
              onClick={handleWalletLogin}
              isLoading={state.isWalletLoading}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-fallback">
          <p className="login-fallback-text">Cargando…</p>
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
