"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchAirdropHistory } from "src/lib/airdrop/fetchAirdropHistoryClient";
import { formatCampaignRangeLabel } from "src/lib/airdrop/schemas";
import type { AirdropHistoryLogRecord } from "src/lib/airdrop/types";

const ACCENT_BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-tonki-accent px-5 py-2.5 text-sm font-semibold leading-none text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { dateStyle: "medium" });
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

function truncateWallet(wallet: string): string {
  if (wallet.length <= 20) return wallet;
  return `${wallet.slice(0, 10)}…${wallet.slice(-8)}`;
}

function StatusIcon({ success }: { success: boolean }) {
  if (success) {
    return (
      <span
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
        title="Exitosa"
        aria-label="Transacción exitosa"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.432.01L3.28 9.78a1 1 0 1 1 1.44-1.39l3.08 3.19 6.49-6.54a1 1 0 0 1 1.414-.006Z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-tonki-danger"
      title="Fallida"
      aria-label="Transacción fallida"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    </span>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-tonki-border py-3 last:border-b-0">
      <span className="text-sm text-tonki-text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-tonki-text">
        {value}
      </span>
    </div>
  );
}

function HistoryLogCard({ log }: { log: AirdropHistoryLogRecord }) {
  const rangeLabel =
    log.config.scheduled_date && log.config.scheduled_end_date
      ? formatCampaignRangeLabel(
          log.config.scheduled_date,
          log.config.scheduled_end_date
        )
      : formatDate(log.config.scheduled_date);

  const assetLabel = log.asset ?? log.config.asset ?? "TONKI";

  const header = log.success
    ? `Envío exitoso · ${formatDateTime(log.executed_at)}`
    : `Envío fallido · ${formatDateTime(log.executed_at)}`;

  return (
    <details className="group overflow-hidden rounded-xl border border-tonki-border bg-tonki-surface shadow-sm">
      <summary className="cursor-pointer list-none border-b border-transparent px-4 py-4 transition-colors hover:bg-tonki-surface-hover group-open:border-tonki-border group-open:bg-tonki-canvas/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <StatusIcon success={log.success} />
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-tonki-text sm:text-base">
                {header}
              </h2>
              <p className="mt-1 text-xs text-tonki-text-faint">
                {assetLabel} · Campaña {rangeLabel} · {log.users_involved}{" "}
                usuario(s) · {formatAmount(log.total_amount)} {assetLabel}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs font-medium text-tonki-text-muted transition-transform group-open:rotate-180">
            ▼
          </span>
        </div>
      </summary>

      <div className="border-t border-tonki-border px-4 py-2">
        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-tonki-text-muted">
          Configuración usada
        </p>
        <StatRow label="Token" value={assetLabel} />
        <StatRow
          label="Monto configurado"
          value={`${formatAmount(log.config.amount)} ${assetLabel}`}
        />
        <StatRow label="Fecha inicio" value={formatDate(log.config.scheduled_date)} />
        <StatRow
          label="Fecha final"
          value={
            log.config.scheduled_end_date
              ? formatDate(log.config.scheduled_end_date)
              : "—"
          }
        />
        <StatRow
          label="Periodicidad"
          value={`${log.config.periodicity_months} mes(es)`}
        />
        <StatRow label="Máx. usuarios" value={String(log.config.max_users)} />
        <StatRow
          label="Hash"
          value={log.transaction_hash?.trim() || "Sin hash"}
        />
        {log.error_message ? (
          <StatRow label="Error" value={log.error_message} />
        ) : null}
        {log.fees ? (
          <>
            <StatRow
              label="Pool usuarios (98%)"
              value={`${formatAmount(log.fees.user_pool)} ${assetLabel}`}
            />
            <StatRow
              label="Fee app (1%)"
              value={`${formatAmount(log.fees.app_fee)} ${assetLabel}`}
            />
            <StatRow
              label="Reserva red (1%)"
              value={`${formatAmount(log.fees.stellar_reserve)} ${assetLabel}`}
            />
          </>
        ) : null}

        <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-tonki-text-muted">
          Destinatarios
        </p>
        {log.recipients.length === 0 ? (
          <p className="py-3 text-sm text-tonki-text-muted">
            No hay detalle de destinatarios en este registro.
          </p>
        ) : (
          <div className="overflow-x-auto py-2">
            <table className="w-full min-w-[420px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-tonki-border text-xs uppercase tracking-wide text-tonki-text-muted">
                  <th className="px-2 py-2 font-semibold">Nombre</th>
                  <th className="px-2 py-2 font-semibold">Wallet</th>
                  <th className="px-2 py-2 font-semibold">%</th>
                  <th className="px-2 py-2 font-semibold">{assetLabel}</th>
                </tr>
              </thead>
              <tbody>
                {log.recipients.map((row) => (
                  <tr
                    key={`${log.log_id}-${row.user_id}`}
                    className="border-b border-tonki-border last:border-b-0"
                  >
                    <td className="px-2 py-2 font-medium text-tonki-text">
                      {row.name}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs text-tonki-text-secondary">
                      {row.wallet_address
                        ? truncateWallet(row.wallet_address)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 tabular-nums text-tonki-text">
                      {formatPercent(row.fund_percent)}%
                    </td>
                    <td className="px-2 py-2 tabular-nums text-tonki-text">
                      {formatAmount(row.amount)} {assetLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </details>
  );
}

export default function AdminAirdropHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<AirdropHistoryLogRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAirdropHistory({
      networkErrorMessage: "No se pudo cargar el historial",
    });

    if (!result.ok) {
      setError(result.error);
      setLogs([]);
    } else {
      setLogs(result.data.logs);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && logs.length === 0 && !error) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center text-sm text-tonki-text-muted sm:px-6">
        Cargando historial…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full border-x border-tonki-border pb-10">
      <header className="border-b border-tonki-border px-4 py-5 sm:px-6">
        <Link
          href="/admin/airdrop"
          className="text-sm font-medium text-tonki-text-muted transition-colors hover:text-tonki-accent"
        >
          ← Volver al airdrop
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-tonki-text">
          Historial de Airdrop
        </h1>
        <p className="mt-1 text-sm text-tonki-text-muted">
          Envíos ejecutados con Freighter: exitosos y fallidos.
        </p>
      </header>

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-tonki-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-4 p-4 sm:p-6">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-10 text-center">
            <p className="text-sm text-tonki-text-muted">
              Aún no hay envíos registrados.
            </p>
            <p className="mt-2 text-xs text-tonki-text-faint">
              Cuando uses “Enviar ahora”, cada intento aparecerá aquí.
            </p>
          </div>
        ) : (
          logs.map((log) => <HistoryLogCard key={log.log_id} log={log} />)
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className={ACCENT_BUTTON}
          >
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>
    </main>
  );
}
