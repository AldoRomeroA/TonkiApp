"use client";

import { useCallback, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { SmartAccountKit, IndexedDBStorage } from "smart-account-kit";
import { readJsonSafely } from "src/lib/api/readJsonSafely";
import {
  buildTonkiStorageName,
  encodePublicKey,
} from "src/lib/wallet/clientHelpers";
import type {
  SmartAccountPublicConfig,
  WalletCreateApiResponse,
  WalletStatusApiResponse,
} from "src/types/wallet";

type Phase =
  | "loading"
  | "ready"
  | "creating"
  | "persisting"
  | "done"
  | "error"
  | "redirecting";

type State = {
  phase: Phase;
  error: string;
  contractAddress: string | null;
};

type Action =
  | { type: "SET_PHASE"; payload: Phase }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_CONTRACT"; payload: string };

const initialState: State = {
  phase: "loading",
  error: "",
  contractAddress: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, phase: "error" };
    case "SET_CONTRACT":
      return { ...state, contractAddress: action.payload };
    default:
      return state;
  }
}

async function fetchWalletConfig(): Promise<SmartAccountPublicConfig> {
  const res = await fetch("/api/wallet/config", { credentials: "include" });
  const body = await readJsonSafely<{ config?: SmartAccountPublicConfig; error?: string }>(
    res
  );
  if (!res.ok || !body?.config) {
    throw new Error(body?.error ?? "No se pudo cargar la configuración de wallet");
  }
  return body.config;
}

async function fetchWalletStatus(): Promise<WalletStatusApiResponse> {
  const res = await fetch("/api/wallet/status", { credentials: "include" });
  const body = await readJsonSafely<WalletStatusApiResponse & { error?: string }>(
    res
  );
  if (res.status === 401) {
    throw new Error("authentication_required");
  }
  if (!res.ok || !body) {
    throw new Error(body?.error ?? "No se pudo verificar el estado de la wallet");
  }
  return body;
}

async function fetchDisplayName(): Promise<string> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const body = await readJsonSafely<{
    user?: { email?: string | null; username?: string | null };
    error?: string;
  }>(res);
  if (!res.ok || !body?.user) {
    return "Tonki user";
  }
  return (
    body.user.username?.trim() ||
    body.user.email?.trim() ||
    "Tonki user"
  );
}

function createKit(config: SmartAccountPublicConfig): SmartAccountKit {
  const storage = new IndexedDBStorage(buildTonkiStorageName(config));
  return new SmartAccountKit({
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    accountWasmHash: config.accountWasmHash,
    webauthnVerifierAddress: config.webauthnVerifierAddress,
    storage,
    rpId: config.rpId,
    rpName: config.rpName,
    relayerUrl: config.relayerUrl ?? undefined,
  });
}

export function WalletOnboardingClient() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const status = await fetchWalletStatus();
        if (cancelled) return;

        if (status.hasWallet && status.wallet) {
          dispatch({ type: "SET_CONTRACT", payload: status.wallet.contract_address });
          dispatch({ type: "SET_PHASE", payload: "redirecting" });
          router.replace("/dashboard");
          return;
        }

        await fetchWalletConfig();
        if (cancelled) return;
        dispatch({ type: "SET_PHASE", payload: "ready" });
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message === "authentication_required"
            ? "Inicia sesión para continuar"
            : err instanceof Error
              ? err.message
              : "No se pudo preparar la wallet";
        if (message === "Inicia sesión para continuar") {
          router.replace("/login?from=%2Fonboarding%2Fwallet");
          return;
        }
        dispatch({ type: "SET_ERROR", payload: message });
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreateWallet = useCallback(async () => {
    dispatch({ type: "SET_ERROR", payload: "" });
    dispatch({ type: "SET_PHASE", payload: "creating" });

    try {
      const [config, displayName] = await Promise.all([
        fetchWalletConfig(),
        fetchDisplayName(),
      ]);
      const kit = createKit(config);

      const result = await kit.createWallet("Tonki", displayName, {
        autoSubmit: true,
        autoFund: config.network === "testnet",
        nativeTokenContract: config.nativeTokenContract,
      });

      if (!result.submitResult?.success) {
        throw new Error(
          result.submitResult?.error ??
            "No se pudo desplegar la smart wallet en Testnet"
        );
      }

      dispatch({ type: "SET_CONTRACT", payload: result.contractId });
      dispatch({ type: "SET_PHASE", payload: "persisting" });

      const transports = result.rawResponse.response.transports?.map(String);

      const persistRes = await fetch("/api/wallet/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: result.contractId,
          credentialId: result.credentialId,
          publicKey: encodePublicKey(result.publicKey),
          publicKeyAlgorithm:
            result.rawResponse.response.publicKeyAlgorithm ?? -7,
          transports,
          deviceLabel: "Passkey principal",
          deploymentTxHash: result.submitResult.hash,
        }),
      });

      const persistBody = await readJsonSafely<
        WalletCreateApiResponse & { error?: string }
      >(persistRes);

      if (!persistRes.ok || !persistBody?.wallet) {
        throw new Error(
          persistBody?.error ??
            "La wallet se creó en Stellar pero no se pudo guardar en Tonki"
        );
      }

      dispatch({ type: "SET_PHASE", payload: "done" });
      router.replace(persistBody.redirectTo ?? "/dashboard");
    } catch (err) {
      console.error("[onboarding/wallet]", err);
      const message =
        err instanceof Error ? err.message : "No se pudo crear la wallet";
      dispatch({ type: "SET_ERROR", payload: message });
      dispatch({ type: "SET_PHASE", payload: "error" });
    }
  }, [router]);

  const isBusy =
    state.phase === "creating" ||
    state.phase === "persisting" ||
    state.phase === "loading" ||
    state.phase === "redirecting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-tonki-canvas px-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-2xl border border-tonki-border bg-tonki-surface p-8 shadow-2xl shadow-black/40">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex rounded-full border border-tonki-accent/30 bg-tonki-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tonki-accent">
            Stellar Testnet
          </span>
          <h1 className="text-2xl font-bold text-tonki-text">
            Crea tu wallet Tonki
          </h1>
          <p className="text-sm text-tonki-text-muted">
            Usa Face ID, huella o bloqueo del dispositivo. Sin frases semilla ni
            extensiones.
          </p>
        </div>

        {state.phase === "loading" || state.phase === "redirecting" ? (
          <p className="text-center text-sm text-tonki-text-muted">
            Preparando…
          </p>
        ) : (
          <>
            <ul className="space-y-3 text-sm text-tonki-text-secondary">
              <li className="flex gap-3">
                <span className="mt-0.5 text-tonki-accent">1.</span>
                <span>Tu passkey queda en este dispositivo (o en tu llavero sincronizado).</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 text-tonki-accent">2.</span>
                <span>Tonki despliega una smart wallet en Stellar Testnet.</span>
              </li>
            </ul>

            <button
              type="button"
              onClick={handleCreateWallet}
              disabled={isBusy || state.phase !== "ready"}
              className="rounded-xl bg-tonki-accent px-4 py-3 font-semibold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-70"
            >
              {state.phase === "creating"
                ? "Creando passkey…"
                : state.phase === "persisting"
                  ? "Guardando wallet…"
                  : "Crear wallet con passkey"}
            </button>

            {state.contractAddress && (
              <p className="break-all text-center text-xs text-tonki-text-faint">
                {state.contractAddress}
              </p>
            )}

            {state.error && (
              <p className="text-center text-sm text-tonki-danger">{state.error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
