import { apiError, apiSuccess } from "src/lib/api/response";
import { parseRequestJson } from "src/lib/api/readJsonSafely";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { loadAirdropEligibleUsers } from "src/lib/airdrop/loadAirdropEligibleUsers";
import { airdropPrepareBodySchema } from "src/lib/airdrop/schemas";
import { prepareAirdropTransaction } from "src/lib/airdrop/sendAirdropTransaction";

export async function POST(req: Request) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const raw = await parseRequestJson(req);
    if (raw === null) {
      return apiError("Cuerpo JSON inválido", 400);
    }

    const parsed = airdropPrepareBodySchema.safeParse(raw);
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

    const result = await prepareAirdropTransaction({
      sourcePublicKey: parsed.data.source_public_key,
      config,
      users,
      asset: config.asset,
    });

    if (!result.ok) {
      return apiError(result.error, 400);
    }

    return apiSuccess({
      unsigned_xdr: result.unsigned_xdr,
      network_passphrase: result.network_passphrase,
      source_public_key: result.source_public_key,
      total_amount: result.total_amount,
      users_involved: result.users_involved,
      fees: result.fees,
      asset: config.asset,
    });
  } catch {
    return apiError("Error al preparar el airdrop", 500);
  }
}
