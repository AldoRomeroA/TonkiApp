import { apiError, apiSuccess } from "src/lib/api/response";
import {
  attachWalletNonceCookie,
  buildWalletChallengeMessage,
  generateWalletNonce,
} from "src/lib/auth/walletChallenge";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";

export async function GET() {
  try {
    const nonce = generateWalletNonce();
    const message = buildWalletChallengeMessage(nonce);
    const res = apiSuccess({ message });
    attachWalletNonceCookie(res, nonce);
    return res;
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/wallet-challenge]",
      err
    );
    if (infra) return infra;
    return apiError("No se pudo iniciar el reto de la cartera", 500);
  }
}
