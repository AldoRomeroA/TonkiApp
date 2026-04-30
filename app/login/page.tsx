"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signMessage,
  isConnected,
  requestAccess,
} from "@stellar/freighter-api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function redirect(data: { redirectTo?: string; user?: { type?: string } }) {
    const dest =
      data.redirectTo ??
      (data.user?.type === "admin" ? "/admin/dashboard" : "/dashboard");
    router.push(dest);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (res.ok) {
      redirect(data);
    } else {
      setError(data.error || "Error en login");
    }
  }

  async function handleWalletLogin() {
    try {
      // 1. Revisar si se encuentra descargada la extension/aplicasion
      const isAppConnected = await isConnected();

      if (isAppConnected.isConnected == false) {
        setError("Freighter no está disponible. Instala la extensión.");
        return;
      }

      // 2. Revisar autorizacion a la wallet por parte del usuario
      const accessRes = await requestAccess();
      if (accessRes.error) {
        setError("Acceso denegado. Aprueba la conexión en Freighter.");
        return;
      }
      const publicKey = accessRes.address;

      // 3. Firmar challenge
      const challenge = "Login con TonkiApp";

      const signRes = await signMessage(challenge, { address: publicKey });
      if (signRes.error) {
        setError("No se pudo firmar el mensaje. Intenta de nuevo.");
        return;
      }

      const signature = signRes.signedMessage;

      // 4. Enviar al backend
      const res = await fetch("/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicKey, signature }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/dashboard");
      } else {
        setError(data.error || "Error en login con wallet");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo conectar la wallet");
    }
  }

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

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Usuario o correo"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-[#0B0B0B] border border-[#2a2a2a] text-neutral-100 placeholder-neutral-500 p-3 rounded-lg focus:outline-none focus:border-[#F6C941] transition-colors"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-[#0B0B0B] border border-[#2a2a2a] text-neutral-100 placeholder-neutral-500 p-3 rounded-lg focus:outline-none focus:border-[#F6C941] transition-colors"
          />
          <button
            type="submit"
            className="mt-1 bg-[#F6C941] text-[#0B0B0B] font-semibold p-3 rounded-lg hover:bg-[#e0b030] transition-colors"
          >
            Entrar
          </button>
        </form>

        {/* Separador */}
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-[#2a2a2a]" />
          <span className="text-xs text-neutral-500">o continúa con</span>
          <hr className="flex-1 border-[#2a2a2a]" />
        </div>

        {/* Wallet */}
        <button
          onClick={handleWalletLogin}
          className="border border-[#F6C941] text-[#F6C941] font-semibold p-3 rounded-lg hover:bg-[#F6C941] hover:text-[#0B0B0B] transition-colors"
        >
          Conectar Wallet (Freighter)
        </button>

        {/* Error */}
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>
    </div>
  );
}
