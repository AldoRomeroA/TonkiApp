import { apiError, apiSuccess } from "src/lib/api/response";
import { parseRequestJson } from "src/lib/api/readJsonSafely";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { AIRDROP_EMISOR_PUBLIC_KEY } from "src/lib/airdrop/constants";
import { loadAirdropEligibleUsers } from "src/lib/airdrop/loadAirdropEligibleUsers";
import { airdropSendBodySchema } from "src/lib/airdrop/schemas";
import { submitSignedAirdropTransaction } from "src/lib/airdrop/sendAirdropTransaction";

export async function POST(req: Request) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const raw = await parseRequestJson(req);
    if (raw === null) {
      return apiError("Cuerpo JSON inválido", 400);
    }

    const parsed = airdropSendBodySchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
      return apiError(first, 400);
    }

    const { config, users } = await loadAirdropEligibleUsers(gate.userId);

    if (!config || config.amount <= 0) {
      return apiError(
        "Configura el monto del airdrop antes de enviarlo",
        400
      );
    }

    if (users.length === 0) {
      return apiError("No hay usuarios elegibles para el airdrop", 400);
    }

    const result = await submitSignedAirdropTransaction({
      signedXdr: parsed.data.signed_xdr,
      config,
      users,
      asset: config.asset,
      expectedSourcePublicKey:
        parsed.data.source_public_key ?? AIRDROP_EMISOR_PUBLIC_KEY,
    });

    if (!result.ok) {
      return apiError(result.error, 502);
    }

    return apiSuccess({
      message: "Transacción enviada con éxito",
      log_id: result.log_id,
      transaction_hash: result.transaction_hash,
      horizon_url: result.horizon_url,
      source_public_key: result.source_public_key,
      total_amount: result.total_amount,
      users_involved: result.users_involved,
      fees: result.fees,
      asset: config.asset,
    });
  } catch {
    return apiError("Error al enviar el airdrop", 500);
  }
}
