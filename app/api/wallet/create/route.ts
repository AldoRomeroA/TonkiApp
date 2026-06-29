import { parseRequestJson } from "src/lib/api/readJsonSafely";
import { apiError, apiSuccess } from "src/lib/api/response";
import { getSessionFromCookies } from "src/lib/auth/session";
import { createSmartWalletRecord } from "src/lib/wallet/createSmartWalletRecord";
import { walletCreateSchema } from "src/lib/wallet/schemas";
import { isSmartWalletConfigured } from "src/lib/wallet/smartAccountConfig";

export async function POST(req: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return apiError("authentication_required", 401);
  }

  if (!isSmartWalletConfigured()) {
    return apiError("smart_wallet_not_configured", 503);
  }

  const raw = await parseRequestJson(req);
  if (raw === null) {
    return apiError("invalid_json", 400);
  }

  const parsed = walletCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError("invalid_wallet_payload", 400);
  }

  try {
    const wallet = await createSmartWalletRecord(session.userId, parsed.data);
    return apiSuccess({
      wallet,
      redirectTo: session.role === "admin" ? "/admin/dashboard" : "/dashboard",
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code === "P2002") {
      return apiError("wallet_conflict", 409);
    }

    const message = err instanceof Error ? err.message : "wallet_create_failed";

    if (message === "wallet_already_exists") {
      return apiError("wallet_already_exists", 409);
    }
    if (message === "contract_already_claimed") {
      return apiError("contract_already_claimed", 409);
    }
    if (message === "credential_already_claimed") {
      return apiError("credential_already_claimed", 409);
    }

    console.error("[api/wallet/create]", err);
    return apiError("wallet_create_failed", 500);
  }
}
