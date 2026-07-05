import { readJsonSafely } from "src/lib/api/readJsonSafely";

import type { AirdropStatsPayload } from "./types";

export type FetchAirdropStatsResult =
  | { ok: true; data: AirdropStatsPayload }
  | { ok: false; error: string; unauthorized?: true };

function isStatsSuccess(
  data: unknown
): data is AirdropStatsPayload & { success: true } {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  return Array.isArray(o.archives);
}

export async function fetchAirdropStats(opts: {
  networkErrorMessage: string;
}): Promise<FetchAirdropStatsResult> {
  try {
    const res = await fetch("/api/admin/airdrop/stats", {
      credentials: "include",
      cache: "no-store",
    });

    if (res.status === 401) {
      return { ok: false, error: "No autenticado", unauthorized: true };
    }

    const body = await readJsonSafely(res);
    if (body === null) {
      return { ok: false, error: "Respuesta inválida del servidor" };
    }

    if (!res.ok) {
      const err = body as { error?: string };
      return { ok: false, error: err.error || `Error ${res.status}` };
    }

    if (!isStatsSuccess(body)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    return {
      ok: true,
      data: { archives: body.archives },
    };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}
