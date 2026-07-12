"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  isConnected,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";

import { AIRDROP_EMISOR_PUBLIC_KEY } from "src/lib/airdrop/constants";
import { fetchAdminAirdrop } from "src/lib/airdrop/fetchAdminAirdropClient";
import {
  prepareAdminAirdrop,
  sendAdminAirdrop,
} from "src/lib/airdrop/fetchSendAirdropClient";
import type { AirdropPagePayload } from "src/lib/airdrop/types";

const ACCENT_BUTTON =
  "box-border inline-flex h-10 w-44 shrink-0 items-center justify-center rounded-xl border-0 bg-tonki-accent px-3 text-[14px] font-semibold leading-none text-tonki-accent-fg no-underline transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 20) return wallet;
  return `${wallet.slice(0, 10)}…${wallet.slice(-8)}`;
}

function formatAmount(value: number): string {
  return value.toLocaleString("es", { maximumFractionDigits: 7 });
}

function formatPercent(value: number): string {
  return value.toLocaleString("es", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function SummaryCard({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-tonki-border border-l-4 border-l-tonki-accent bg-tonki-surface px-4 py-4 shadow-sm ${
        wide ? "sm:col-span-2" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-tonki-text-muted">
        {label}
      </p>
      <p className="mt-2 break-all text-lg font-bold tabular-nums text-tonki-text sm:text-xl">
        {value}
      </p>
    </div>
  );
}

export default function AdminAirdropPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AirdropPagePayload | null>(null);
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<{
    message: string;
    horizon_url: string;
    transaction_hash: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAdminAirdrop({
      networkErrorMessage: "No se pudo cargar el airdrop",
    });

    if (!result.ok) {
      setError(result.error);
      setData(null);
    } else {
      setData(result.data);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSendNow = useCallback(async () => {
    setSendError(null);
    setSendSuccess(null);
    setSending(true);
    setSendStatus("Conectando con Freighter…");

    try {
      const connected = await isConnected();
      if (!connected.isConnected) {
        setSendError("Freighter no está disponible. Instala la extensión.");
        return;
      }

      const access = await requestAccess();
      if (access.error || !access.address) {
        setSendError("Acceso denegado. Aprueba la conexión en Freighter.");
        return;
      }

      const publicKey = access.address;
      if (publicKey !== AIRDROP_EMISOR_PUBLIC_KEY) {
        setSendError(
          "Freighter debe usar la wallet emisora del airdrop. Cambia de cuenta en Freighter."
        );
        return;
      }

      setSendStatus("Preparando transacción…");
      const prepared = await prepareAdminAirdrop({
        sourcePublicKey: publicKey,
      });
      if (!prepared.ok) {
        setSendError(prepared.error);
        return;
      }

      setSendStatus("Firma la transacción en Freighter…");
      const signed = await signTransaction(prepared.data.unsigned_xdr, {
        networkPassphrase: prepared.data.network_passphrase,
        address: publicKey,
      });
      if (signed.error || !signed.signedTxXdr) {
        const freighterMsg =
          signed.error &&
          typeof signed.error === "object" &&
          "message" in signed.error &&
          typeof (signed.error as { message: unknown }).message === "string"
            ? (signed.error as { message: string }).message
            : null;
        setSendError(
          freighterMsg || "No se pudo firmar la transacción en Freighter."
        );
        return;
      }

      setSendStatus("Enviando a la red Stellar…");
      const submitted = await sendAdminAirdrop({
        signedXdr: signed.signedTxXdr,
        sourcePublicKey: publicKey,
      });
      if (!submitted.ok) {
        setSendError(submitted.error);
        return;
      }

      setSendSuccess({
        message: submitted.data.message,
        horizon_url: submitted.data.horizon_url,
        transaction_hash: submitted.data.transaction_hash,
      });
      await load();
    } catch (err) {
      console.error(err);
      setSendError(
        err instanceof Error ? err.message : "No se pudo enviar el airdrop"
      );
    } finally {
      setSending(false);
      setSendStatus(null);
    }
  }, [load]);

  if (loading && !data) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center text-sm text-tonki-text-muted sm:px-6">
        Cargando airdrop…
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center sm:px-6">
        <p className="text-sm text-tonki-danger">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-xl border border-tonki-border px-4 py-2 text-sm font-semibold text-tonki-text-secondary hover:bg-tonki-surface-hover"
        >
          Reintentar
        </button>
      </main>
    );
  }

  if (!data) return null;

  const canSend =
    data.amount > 0 &&
    data.users.length > 0 &&
    data.users.every((u) => Boolean(u.wallet_address?.trim()));

  return (
    <main className="mx-auto w-full border-x border-tonki-border pb-8">
      <header className="border-b border-tonki-border px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-tonki-text">
          Airdrop
        </h1>
        <p className="mt-1 text-sm text-tonki-text-muted">
          Recompensas para tus usuarios más activos
        </p>
      </header>

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-tonki-danger">
          {error}
        </p>
      ) : null}

      {sendError ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-tonki-danger">
          {sendError}
        </p>
      ) : null}

      {sendSuccess ? (
        <div className="border-b border-tonki-accent/30 bg-tonki-accent/10 px-4 py-3 text-center text-sm text-tonki-text">
          <p className="font-medium">{sendSuccess.message}</p>
          <a
            href={sendSuccess.horizon_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-tonki-text-secondary underline hover:text-tonki-text"
          >
            Ver en Horizon ({sendSuccess.transaction_hash.slice(0, 8)}…)
          </a>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <SummaryCard
          label="Monto configurado"
          value={`${formatAmount(data.amount)} ${data.asset}`}
        />
        <SummaryCard label="Token" value={data.asset} />
        <SummaryCard
          label="Wallet emisora"
          value={data.source_public_key?.trim() || "Sin wallet registrada"}
        />
      </div>

      {(data.scheduled_date ||
        data.scheduled_end_date ||
        data.max_users > 0 ||
        data.periodicity_months > 0) && (
        <div className="mx-4 mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.scheduled_date ? (
            <SummaryCard
              label="Fecha inicio programada"
              value={new Date(data.scheduled_date).toLocaleDateString("es", {
                dateStyle: "medium",
              })}
            />
          ) : null}
          {data.scheduled_end_date ? (
            <SummaryCard
              label="Fecha final programada"
              value={new Date(data.scheduled_end_date).toLocaleDateString("es", {
                dateStyle: "medium",
              })}
            />
          ) : null}
          {data.max_users > 0 ? (
            <SummaryCard
              label="Máx. usuarios"
              value={String(data.max_users)}
            />
          ) : null}
          {data.periodicity_months > 0 ? (
            <SummaryCard
              label="Periodicidad"
              value={`${data.periodicity_months} meses`}
            />
          ) : null}
        </div>
      )}

      <section className="mx-4 overflow-hidden rounded-xl border border-tonki-border bg-tonki-surface shadow-sm">
        <div className="border-b border-tonki-chrome-border bg-tonki-chrome px-4 py-3">
          <h2 className="text-sm font-semibold text-tonki-chrome-text">
            Lista de usuarios
          </h2>
        </div>

        {data.users.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-tonki-text-muted">
            No hay usuarios con puntos elegibles todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-tonki-border bg-tonki-canvas text-xs uppercase tracking-wide text-tonki-text-muted">
                  <th className="px-3 py-2 font-semibold">ID</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Wallet address</th>
                  <th className="px-3 py-2 font-semibold">Tonkis</th>
                  <th className="px-3 py-2 font-semibold">% del fondo</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr
                    key={user.user_id}
                    className="border-b border-tonki-border last:border-b-0 odd:bg-tonki-surface even:bg-tonki-canvas/60"
                  >
                    <td className="px-3 py-2.5 font-mono text-xs text-tonki-text-secondary">
                      {truncateId(user.user_id)}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-tonki-text">
                      {user.name}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-tonki-text-secondary">
                      {user.wallet_address?.trim() ? (
                        truncateWallet(user.wallet_address.trim())
                      ) : (
                        <span className="text-tonki-text-faint">Sin wallet</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-tonki-text">
                      {user.tonkis.toLocaleString("es")}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-tonki-text">
                      {formatPercent(user.fund_percent)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-tonki-border px-4 py-2 text-xs text-tonki-text-faint">
          Mostrando {data.users.length} usuario(s) · el % suma ~98% (1% app + 1%
          red)
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pt-4">
        <Link href="/admin/airdrop/configure" className={ACCENT_BUTTON}>
          Configurar
        </Link>
        <Link href="/admin/airdrop/stats" className={ACCENT_BUTTON}>
          Estadísticas
        </Link>
        <Link href="/admin/airdrop/historial" className={ACCENT_BUTTON}>
          Historial
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || sending}
          className={ACCENT_BUTTON}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
        <button
          type="button"
          onClick={() => void handleSendNow()}
          disabled={!canSend || sending}
          className={ACCENT_BUTTON}
          title={
            !canSend
              ? "Necesitas monto, usuarios elegibles y wallets completas"
              : "Firma con Freighter (wallet emisora)"
          }
        >
          {sending ? "Enviando…" : "Enviar ahora"}
        </button>
      </div>

      {sending && sendStatus ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-2xl border border-tonki-border bg-tonki-surface p-5 text-center shadow-xl">
            <p className="text-sm font-semibold text-tonki-text">{sendStatus}</p>
            <p className="mt-2 text-xs text-tonki-text-muted">
              Aprueba la solicitud en la extensión Freighter.
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
