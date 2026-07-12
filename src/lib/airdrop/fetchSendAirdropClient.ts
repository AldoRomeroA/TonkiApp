import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AirdropAssetCode } from "src/lib/airdrop/constants";

export type PrepareAirdropSuccess = {
  unsigned_xdr: string;
  network_passphrase: string;
  source_public_key: string;
  total_amount: number;
  users_involved: number;
  asset: AirdropAssetCode;
  fees: {
    user_pool: number;
    app_fee: number;
    stellar_reserve: number;
    app_fee_destination: string;
  };
};

export type SendAirdropSuccess = {
  message: string;
  log_id: string;
  transaction_hash: string;
  horizon_url: string;
  source_public_key: string;
  total_amount: number;
  users_involved: number;
  asset: AirdropAssetCode;
  fees: {
    user_pool: number;
    app_fee: number;
    stellar_reserve: number;
    app_fee_destination: string;
  };
};

export type PrepareAirdropResult =
  | { ok: true; data: PrepareAirdropSuccess }
  | { ok: false; error: string; unauthorized?: true };

export type SendAirdropResult =
  | { ok: true; data: SendAirdropSuccess }
  | { ok: false; error: string; unauthorized?: true };

export async function prepareAdminAirdrop(opts: {
  sourcePublicKey: string;
}): Promise<PrepareAirdropResult> {
  try {
    const res = await fetch("/api/admin/airdrop/prepare", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_public_key: opts.sourcePublicKey,
      }),
    });

    if (res.status === 401) {
      return { ok: false, error: "No autenticado", unauthorized: true };
    }

    const body = await readJsonSafely<
      PrepareAirdropSuccess & { success?: boolean; error?: string }
    >(res);

    if (body === null) {
      return { ok: false, error: "Respuesta inválida del servidor" };
    }

    if (!res.ok) {
      return { ok: false, error: body.error || `Error ${res.status}` };
    }

    if (!body.unsigned_xdr || !body.network_passphrase) {
      return { ok: false, error: "Formato de preparación inesperado" };
    }

    return {
      ok: true,
      data: {
        unsigned_xdr: body.unsigned_xdr,
        network_passphrase: body.network_passphrase,
        source_public_key: body.source_public_key,
        total_amount: body.total_amount,
        users_involved: body.users_involved,
        fees: body.fees,
        asset: body.asset,
      },
    };
  } catch {
    return { ok: false, error: "No se pudo preparar el airdrop" };
  }
}

export async function sendAdminAirdrop(opts: {
  signedXdr: string;
  sourcePublicKey?: string;
}): Promise<SendAirdropResult> {
  try {
    const res = await fetch("/api/admin/airdrop/send", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signed_xdr: opts.signedXdr,
        ...(opts.sourcePublicKey
          ? { source_public_key: opts.sourcePublicKey }
          : {}),
      }),
    });

    if (res.status === 401) {
      return { ok: false, error: "No autenticado", unauthorized: true };
    }

    const body = await readJsonSafely<
      SendAirdropSuccess & { success?: boolean; error?: string }
    >(res);

    if (body === null) {
      return { ok: false, error: "Respuesta inválida del servidor" };
    }

    if (!res.ok) {
      return { ok: false, error: body.error || `Error ${res.status}` };
    }

    if (!body.transaction_hash || !body.horizon_url) {
      return { ok: false, error: "Formato de respuesta inesperado" };
    }

    return {
      ok: true,
      data: {
        message: body.message ?? "Transacción enviada con éxito",
        log_id: body.log_id,
        transaction_hash: body.transaction_hash,
        horizon_url: body.horizon_url,
        source_public_key: body.source_public_key,
        total_amount: body.total_amount,
        users_involved: body.users_involved,
        fees: body.fees,
        asset: body.asset,
      },
    };
  } catch {
    return { ok: false, error: "No se pudo enviar el airdrop" };
  }
}
