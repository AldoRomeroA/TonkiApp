"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { fetchAirdropStats } from "src/lib/airdrop/fetchAirdropStatsClient";
import { formatCampaignRangeLabel } from "src/lib/airdrop/schemas";
import type { AirdropCampaignArchiveRecord } from "src/lib/airdrop/types";

const ACCENT_BUTTON =
  "rounded-full bg-tonki-accent px-5 py-2.5 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { dateStyle: "medium" });
}

function formatAmount(value: number): string {
  return value.toLocaleString("es", { maximumFractionDigits: 7 });
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

function CampaignArchiveCard({ archive }: { archive: AirdropCampaignArchiveRecord }) {
  const header = `Airdrop: ${formatCampaignRangeLabel(
    archive.campaign_start,
    archive.campaign_end
  )}`;

  return (
    <details className="group overflow-hidden rounded-xl border border-tonki-border bg-tonki-surface shadow-sm">
      <summary className="cursor-pointer list-none border-b border-transparent px-4 py-4 transition-colors hover:bg-tonki-surface-hover group-open:border-tonki-border group-open:bg-tonki-canvas/60">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-tonki-text sm:text-base">
            {header}
          </h2>
          <span className="shrink-0 text-xs font-medium text-tonki-text-muted transition-transform group-open:rotate-180">
            ▼
          </span>
        </div>
        <p className="mt-1 text-xs text-tonki-text-faint">
          Archivado el {formatDate(archive.archived_at)}
        </p>
      </summary>

      <div className="border-t border-tonki-border px-4 py-2">
        <StatRow
          label="Usuarios que visitaron el establecimiento"
          value={archive.visitors_count.toLocaleString("es")}
        />
        <StatRow
          label="Compras registradas en la campaña"
          value={archive.purchase_count.toLocaleString("es")}
        />
        <StatRow
          label="Total acumulado (Tonkis en visitas)"
          value={formatAmount(archive.total_spent)}
        />
        <StatRow
          label="Fecha de inicio"
          value={formatDate(archive.campaign_start)}
        />
        <StatRow
          label="Fecha final"
          value={formatDate(archive.campaign_end)}
        />
        <StatRow
          label="Balance enviado (XLM)"
          value={formatAmount(archive.balance_sent)}
        />
        <StatRow
          label="Usuarios a los que se envió"
          value={archive.users_sent.toLocaleString("es")}
        />
      </div>
    </details>
  );
}

export default function AdminAirdropStatsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archives, setArchives] = useState<AirdropCampaignArchiveRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAirdropStats({
      networkErrorMessage: "No se pudieron cargar las estadísticas",
    });

    if (!result.ok) {
      setError(result.error);
      setArchives([]);
    } else {
      setArchives(result.data.archives);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && archives.length === 0 && !error) {
    return (
      <main className="mx-auto w-full px-4 py-14 text-center text-sm text-tonki-text-muted sm:px-6">
        Cargando estadísticas…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full border-x border-tonki-border pb-10">
      <header className="border-b border-tonki-border bg-tonki-surface px-4 py-5 sm:px-6">
        <Link
          href="/admin/airdrop"
          className="text-sm font-medium text-tonki-text-muted transition-colors hover:text-tonki-accent"
        >
          ← Volver al airdrop
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-tonki-text">
          Estadísticas de Airdrop
        </h1>
        <p className="mt-1 text-sm text-tonki-text-muted">
          Campañas finalizadas archivadas automáticamente al terminar su fecha
          final programada.
        </p>
      </header>

      {error ? (
        <p className="border-b border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-tonki-danger">
          {error}
        </p>
      ) : null}

      <div className="space-y-4 p-4 sm:p-6">
        {archives.length === 0 ? (
          <div className="rounded-xl border border-tonki-border bg-tonki-canvas px-4 py-10 text-center">
            <p className="text-sm text-tonki-text-muted">
              Aún no hay campañas archivadas.
            </p>
            <p className="mt-2 text-xs text-tonki-text-faint">
              Cuando una campaña supere su fecha final programada, sus
              estadísticas aparecerán aquí.
            </p>
          </div>
        ) : (
          archives.map((archive) => (
            <CampaignArchiveCard key={archive.archive_id} archive={archive} />
          ))
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
