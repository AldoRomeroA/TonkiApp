import { apiError, apiSuccess } from "src/lib/api/response";
import {
  getSmartAccountPublicConfig,
  isSmartWalletConfigured,
} from "src/lib/wallet/smartAccountConfig";

export async function GET(req: Request) {
  if (!isSmartWalletConfigured()) {
    return apiError("smart_wallet_not_configured", 503);
  }

  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  return apiSuccess({
    config: getSmartAccountPublicConfig(origin),
  });
}
