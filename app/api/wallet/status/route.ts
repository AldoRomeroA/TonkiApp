import { apiError, apiSuccess } from "src/lib/api/response";
import { getSessionFromCookies } from "src/lib/auth/session";
import prisma from "src/lib/db";
import { getStellarNetwork } from "src/lib/wallet/smartAccountConfig";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return apiError("authentication_required", 401);
  }

  const network = getStellarNetwork();
  const wallet = await prisma.smartWallet.findUnique({
    where: {
      user_id_network: {
        user_id: session.userId,
        network,
      },
    },
    select: {
      wallet_id: true,
      contract_address: true,
      network: true,
      status: true,
      created_at: true,
    },
  });

  return apiSuccess({
    hasWallet: Boolean(wallet),
    wallet,
  });
}
