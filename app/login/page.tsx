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
    <div className="flex flex-col gap-6 max-w-sm mx-auto mt-10 p-6 border rounded shadow">
      <h2 className="text-xl font-bold text-center">Iniciar sesión</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Usuario o correo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border p-2 rounded"
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
        />

        <button
          type="submit"
          className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          Entrar
        </button>
      </form>

      <hr />

      <button
        onClick={handleWalletLogin}
        className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
      >
        Conectar Wallet (Frighter)
      </button>

      {error && <p className="text-red-600 text-center">{error}</p>}
    </div>
  );
}
