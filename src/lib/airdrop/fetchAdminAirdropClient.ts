import { readJsonSafely } from "src/lib/api/readJsonSafely";

import {
  isAirdropPageSuccess,
  type AirdropPagePayload,
} from "./types";

export type FetchAdminAirdropResult =
  | { ok: true; data: AirdropPagePayload }
  | { ok: false; error: string; unauthorized?: true };

export async function fetchAdminAirdrop(opts: {
  networkErrorMessage: string;
}): Promise<FetchAdminAirdropResult> {
  try {
    const res = await fetch("/api/admin/airdrop", {
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

    if (!isAirdropPageSuccess(body)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    const {
      amount,
      source_public_key,
      scheduled_date,
      scheduled_end_date,
      max_users,
      periodicity_months,
      users,
    } = body;

    return {
      ok: true,
      data: {
        amount,
        source_public_key,
        scheduled_date,
        scheduled_end_date: scheduled_end_date ?? null,
        max_users,
        periodicity_months,
        users,
      },
    };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}
