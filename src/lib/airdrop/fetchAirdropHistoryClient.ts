import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type {
  AirdropHistoryLogRecord,
  AirdropHistoryPayload,
} from "src/lib/airdrop/types";

export type FetchAirdropHistoryResult =
  | { ok: true; data: AirdropHistoryPayload }
  | { ok: false; error: string; unauthorized?: true };

function isHistoryPayload(data: unknown): data is AirdropHistoryPayload & {
  success: true;
} {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  return o.success === true && Array.isArray(o.logs);
}

export async function fetchAirdropHistory(opts: {
  networkErrorMessage: string;
}): Promise<FetchAirdropHistoryResult> {
  try {
    const res = await fetch("/api/admin/airdrop/history", {
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

    if (!isHistoryPayload(body)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    return {
      ok: true,
      data: {
        logs: body.logs as AirdropHistoryLogRecord[],
      },
    };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}
