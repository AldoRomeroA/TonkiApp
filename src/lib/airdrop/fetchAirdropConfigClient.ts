import { readJsonSafely } from "src/lib/api/readJsonSafely";

import type { AirdropConfigFormValues } from "./schemas";
import type { AirdropConfigPayload } from "./types";

export type FetchAirdropConfigResult =
  | { ok: true; data: AirdropConfigPayload }
  | { ok: false; error: string; unauthorized?: true };

export type SaveAirdropConfigResult =
  | { ok: true; config: NonNullable<AirdropConfigPayload["config"]> }
  | { ok: false; error: string; unauthorized?: true };

function isConfigGetSuccess(
  data: unknown
): data is AirdropConfigPayload & { success: true } {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  if (!("config" in o)) return false;
  if (o.config === null) return true;
  if (typeof o.config !== "object" || o.config === null) return false;
  const c = o.config as Record<string, unknown>;
  return (
    typeof c.amount === "number" &&
    (c.asset === "TONKI" || c.asset === "XLM" || c.asset === "USDC") &&
    typeof c.scheduled_date === "string" &&
    (c.scheduled_end_date === null ||
      typeof c.scheduled_end_date === "string") &&
    typeof c.periodicity_months === "number" &&
    typeof c.max_users === "number"
  );
}

export async function fetchAirdropConfig(opts: {
  networkErrorMessage: string;
}): Promise<FetchAirdropConfigResult> {
  try {
    const res = await fetch("/api/admin/airdrop/config", {
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

    if (!isConfigGetSuccess(body)) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    return { ok: true, data: { config: body.config } };
  } catch {
    return { ok: false, error: opts.networkErrorMessage };
  }
}

export async function saveAirdropConfig(
  values: AirdropConfigFormValues
): Promise<SaveAirdropConfigResult> {
  try {
    const res = await fetch("/api/admin/airdrop/config", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
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

    if (
      typeof body !== "object" ||
      body === null ||
      (body as { success?: boolean }).success !== true
    ) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    const config = (body as { config?: unknown }).config;
    if (
      typeof config !== "object" ||
      config === null ||
      typeof (config as { amount?: unknown }).amount !== "number"
    ) {
      return { ok: false, error: "Formato de datos inesperado" };
    }

    return {
      ok: true,
      config: config as NonNullable<AirdropConfigPayload["config"]>,
    };
  } catch {
    return { ok: false, error: "No se pudo guardar la configuración" };
  }
}
