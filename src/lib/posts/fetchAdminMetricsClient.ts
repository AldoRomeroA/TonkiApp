import { readJsonSafely } from "src/lib/api/readJsonSafely";

export type AdminMetricsPost = {
  post_id: string;
  title: string;
  view_count: number;
  share_count: number;
  created_at: string;
};

export type AdminMetricsPayload = {
  totals: {
    post_count: number;
    total_views: number;
    total_shares: number;
    avg_views: number;
    avg_shares: number;
  };
  top_by_views: AdminMetricsPost[];
  top_by_shares: AdminMetricsPost[];
};

type AdminMetricsSuccessBody = AdminMetricsPayload & { success: true };

export type FetchAdminMetricsResult =
  | { ok: true; metrics: AdminMetricsPayload }
  | { ok: false; error: string; unauthorized?: true };

function isAdminMetricsSuccess(data: unknown): data is AdminMetricsSuccessBody {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  if (typeof o.totals !== "object" || o.totals === null) return false;
  if (!Array.isArray(o.top_by_views) || !Array.isArray(o.top_by_shares)) {
    return false;
  }
  return true;
}

export async function fetchAdminMetrics(opts: {
  networkErrorMessage: string;
}): Promise<FetchAdminMetricsResult> {
  try {
    const res = await fetch("/api/admin/metrics", {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      return { ok: false, error: "No autenticado", unauthorized: true };
    }

    const data = await readJsonSafely(res);
    if (data === null) {
      return { ok: false, error: "Respuesta inválida del servidor" };
    }

    if (!res.ok) {
      const err = data as { error?: string };
      return { ok: false, error: err.error || `Error ${res.status}` };
    }

    if (!isAdminMetricsSuccess(data)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    const { totals, top_by_views, top_by_shares } = data;
    return {
      ok: true,
      metrics: { totals, top_by_views, top_by_shares },
    };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}
