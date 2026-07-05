"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchAdminAirdrop } from "src/lib/airdrop/fetchAdminAirdropClient";
import type { AirdropPagePayload } from "src/lib/airdrop/types";

const ACCENT_BUTTON =
  "rounded-full bg-tonki-accent px-5 py-2.5 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

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
          className="mt-4 rounded-full border border-tonki-border px-4 py-2 text-sm font-semibold text-tonki-text-secondary hover:bg-tonki-surface-hover"
        >
          Reintentar
        </button>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="mx-auto w-full border-x border-tonki-border pb-8">
      <header className="border-b border-tonki-border bg-tonki-surface px-4 py-5 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-tonki-text">Airdrop</h1>
        <p className="mt-1 text-sm text-tonki-text-muted">
          Recompensas para tus usuarios más activos
        </p>
      </header>

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-sm text-tonki-danger">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
        <SummaryCard label="Balance" value={formatAmount(data.amount)} />
        <SummaryCard
          label="Wallet del Airdrop"
          value={data.source_public_key?.trim() || "Sin wallet registrada"}
          wide
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
          Mostrando {data.users.length} usuario(s)
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-3 px-4 pt-4">
        <Link href="/admin/airdrop/configure" className={ACCENT_BUTTON}>
          Configurar
        </Link>
        <Link href="/admin/airdrop/stats" className={ACCENT_BUTTON}>
          Estadísticas
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={ACCENT_BUTTON}
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
    </main>
  );
}
