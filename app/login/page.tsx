"use client";
import { memo, useCallback, useReducer } from "react";
import { useRouter } from "next/navigation";
import {
  signMessage,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";
import { AUTH_CHALLENGE } from "src/lib/auth/constants";

type LoginState = {
  username: string;
  password: string;
  error: string;
  isSubmitting: boolean;
  isWalletLoading: boolean;
};

type LoginAction =
  | { type: "SET_USERNAME"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_WALLET_LOADING"; payload: boolean };

const initialState: LoginState = {
  username: "",
  password: "",
  error: "",
  isSubmitting: false,
  isWalletLoading: false,
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
    default:
      return state;
  }
}

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
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Usuario o correo"
        value={username}
        onChange={(e) => onUsernameChange(e.target.value)}
        className="bg-[#0B0B0B] border border-[#2a2a2a] text-neutral-100 placeholder-neutral-500 p-3 rounded-lg focus:outline-none focus:border-[#F6C941] transition-colors"
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        className="bg-[#0B0B0B] border border-[#2a2a2a] text-neutral-100 placeholder-neutral-500 p-3 rounded-lg focus:outline-none focus:border-[#F6C941] transition-colors"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 bg-[#F6C941] text-[#0B0B0B] font-semibold p-3 rounded-lg hover:bg-[#e0b030] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
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
      className="border border-[#F6C941] text-[#F6C941] font-semibold p-3 rounded-lg hover:bg-[#F6C941] hover:text-[#0B0B0B] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isLoading ? "Conectando..." : "Conectar Wallet (Freighter)"}
    </button>
  );
});

export default function LoginPage() {
  const [state, dispatch] = useReducer(loginReducer, initialState);
  const router = useRouter();

  const redirect = useCallback(
    (data: { redirectTo?: string; user?: { type?: string } }) => {
      const dest =
        data.redirectTo ??
        (data.user?.type === "admin" ? "/admin/dashboard" : "/dashboard");
      router.push(dest);
    },
    [router]
  );

  const handleLoginSuccess = useCallback(
    (data: { redirectTo?: string; user?: { type?: string } }) => {
      redirect(data);
    },
    [redirect]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      dispatch({ type: "SET_ERROR", payload: "" });
      dispatch({ type: "SET_SUBMITTING", payload: true });

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: state.username,
            password: state.password,
          }),
        });

        const data = await res.json();
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

      if (isAppConnected.isConnected == false) {
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

      const signRes = await signMessage(AUTH_CHALLENGE, { address: publicKey });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, signature }),
      });

      const data = await res.json();
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

  const handleUsernameChange = useCallback((value: string) => {
    dispatch({ type: "SET_USERNAME", payload: value });
  }, []);

  const handlePasswordChange = useCallback((value: string) => {
    dispatch({ type: "SET_PASSWORD", payload: value });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B0B0B]">
      <div className="flex flex-col gap-6 w-full max-w-sm mx-auto p-8 rounded-2xl border border-[#2a2a2a] bg-[#161616] shadow-xl">
        {/* Logo / Título */}
        <div className="flex flex-col items-center gap-1 mb-2">
          <span className="text-3xl font-bold text-[#F6C941] tracking-wide">
            TonkiApp
          </span>
          <p className="text-sm text-neutral-400">Inicia sesión en tu cuenta</p>
        </div>

        <LoginForm
          username={state.username}
          password={state.password}
          isSubmitting={state.isSubmitting}
          onUsernameChange={handleUsernameChange}
          onPasswordChange={handlePasswordChange}
          onSubmit={handleSubmit}
        />

        {/* Separador */}
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-[#2a2a2a]" />
          <span className="text-xs text-neutral-500">o continúa con</span>
          <hr className="flex-1 border-[#2a2a2a]" />
        </div>

        <WalletButton
          onClick={handleWalletLogin}
          isLoading={state.isWalletLoading}
        />

        {/* Error */}
        {state.error && (
          <p className="text-red-400 text-sm text-center">{state.error}</p>
        )}
      </div>
    </div>
  );
}
