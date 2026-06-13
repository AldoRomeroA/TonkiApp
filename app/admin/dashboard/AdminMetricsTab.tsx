"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminMetrics,
  type AdminMetricsPost,
  type AdminMetricsPayload,
} from "src/lib/posts/fetchAdminMetricsClient";

function formatCount(n: number): string {
  return n.toLocaleString("es");
}

function formatAvg(n: number): string {
  return n.toLocaleString("es", { maximumFractionDigits: 1 });
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-tonki-border bg-tonki-elevated/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-tonki-text-muted">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-tonki-text">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-tonki-text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function TopPostsList({
  title,
  posts,
  highlight,
  emptyMessage,
}: {
  title: string;
  posts: AdminMetricsPost[];
  highlight: "views" | "shares";
  emptyMessage: string;
}) {
  return (
    <section className="border-t border-tonki-border">
      <h2 className="px-4 py-3 text-sm font-semibold text-tonki-text-secondary">
        {title}
      </h2>
      {posts.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-tonki-text-muted">{emptyMessage}</p>
      ) : (
        <ol className="divide-y divide-tonki-border">
          {posts.map((p, index) => {
            const dt = new Date(p.created_at).toLocaleDateString("es", {
              dateStyle: "medium",
            });

            return (
              <li
                key={p.post_id}
                className="flex items-start gap-3 px-4 py-3 transition hover:bg-tonki-surface-hover/30"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tonki-accent/15 text-xs font-bold tabular-nums text-tonki-accent">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-tonki-text">
                    {p.title}
                  </p>
                  <p className="mt-0.5 text-xs text-tonki-text-faint">{dt}</p>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums">
                  <p
                    className={
                      highlight === "views"
                        ? "font-semibold text-tonki-text"
                        : "text-tonki-text-muted"
                    }
                  >
                    {formatCount(p.view_count)} vistas
                  </p>
                  <p
                    className={
                      highlight === "shares"
                        ? "font-semibold text-tonki-accent"
                        : "text-tonki-text-muted"
                    }
                  >
                    {formatCount(p.share_count)} compartidos
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function AdminMetricsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetricsPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAdminMetrics({
      networkErrorMessage: "No se pudieron cargar las métricas",
    });

    if (!result.ok) {
      setError(result.error);
      setMetrics(null);
    } else {
      setMetrics(result.metrics);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !metrics) {
    return (
      <div className="border-x border-tonki-border px-4 py-14 text-center text-sm text-tonki-text-muted">
        Cargando métricas…
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="border-x border-tonki-border px-4 py-14 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full border border-tonki-border px-4 py-2 text-sm font-semibold text-tonki-text-secondary hover:bg-tonki-elevated"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const { totals, top_by_views, top_by_shares } = metrics;
  const engagementRate =
    totals.total_views > 0
      ? (totals.total_shares / totals.total_views) * 100
      : 0;

  return (
    <div className="border-x border-tonki-border min-h-[50vh]">
      <div className="flex items-center justify-between border-b border-tonki-border px-4 py-3">
        <p className="text-sm text-tonki-text-muted">
          Resumen de tus publicaciones
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-tonki-border px-3 py-1 text-xs font-semibold text-tonki-text-secondary transition hover:bg-tonki-elevated disabled:opacity-50"
        >
          {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </div>

      {error ? (
        <p className="border-b border-red-900/40 bg-red-950/20 px-4 py-2 text-center text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 p-4">
        <StatCard
          label="Vistas totales"
          value={formatCount(totals.total_views)}
        />
        <StatCard
          label="Compartidos"
          value={formatCount(totals.total_shares)}
        />
        <StatCard
          label="Publicaciones"
          value={formatCount(totals.post_count)}
        />
        <StatCard
          label="Media por post"
          value={formatAvg(totals.avg_views)}
          hint={`${formatAvg(totals.avg_shares)} compartidos de media`}
        />
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-tonki-border bg-tonki-elevated/30 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-tonki-text-muted">
          Tasa de compartidos
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-tonki-accent">
          {formatAvg(engagementRate)}%
        </p>
        <p className="mt-0.5 text-xs text-tonki-text-faint">
          Compartidos por cada 100 vistas
        </p>
      </div>

      <TopPostsList
        title="Más vistas"
        posts={top_by_views}
        highlight="views"
        emptyMessage="Publica contenido para ver estadísticas de vistas."
      />

      <TopPostsList
        title="Más compartidos"
        posts={top_by_shares}
        highlight="shares"
        emptyMessage="Cuando alguien comparta tus posts, aparecerán aquí."
      />
    </div>
  );
}
