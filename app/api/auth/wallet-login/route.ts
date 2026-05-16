// app/api/auth/wallet-login/route.ts
import { cookies } from "next/headers";
import prisma from "src/lib/db";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createHash } from "crypto";
import { parseRequestJson } from "src/lib/api/readJsonSafely";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import { walletLoginSchema } from "src/lib/auth/schemas";
import {
  attachSessionCookie,
  createSessionToken,
} from "src/lib/auth/session";
import { applyAuthFailureDelay } from "src/lib/auth/security";
import type { AuthResponse } from "src/types/auth";
import { normalizeUserRole } from "src/lib/auth/userRole";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import {
  WALLET_NONCE_COOKIE,
  buildWalletChallengeMessage,
  clearWalletNonceCookie,
} from "src/lib/auth/walletChallenge";

/** Debe coincidir con el prefijo que usa Freighter `signMessage` (@stellar/freighter-api). */
const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";
const TEST_USERS = [
  {
    wallet_address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    name: "Test User",
    type: "user" as const,
    status: "active" as const,
  },
  {
    wallet_address: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBRD",
    name: "Test Admin",
    type: "admin" as const,
    status: "active" as const,
  },
];

export async function POST(req: Request) {
  try {
    const raw = await parseRequestJson(req);
    if (raw === null) {
      return apiError("Error de autenticación: cuerpo JSON inválido", 400);
    }

    const parsed = walletLoginSchema.safeParse(raw);
    if (!parsed.success) {
      return apiError("Error de autenticación: datos incompletos", 400);
    }
    const { publicKey, signature } = parsed.data;

    const jar = await cookies();
    const expectedNonce =
      jar.get(WALLET_NONCE_COOKIE)?.value?.trim().toLowerCase() ?? null;

    let isValid = false;
    let expectedMessage = "";
    if (expectedNonce && /^[0-9a-f]{32}$/i.test(expectedNonce)) {
      expectedMessage = buildWalletChallengeMessage(expectedNonce);
    }

    try {
      if (!expectedMessage) {
        await applyAuthFailureDelay();
        const res = apiError(
          "Error de autenticación: solicita un nuevo reto de wallet",
          401
        );
        clearWalletNonceCookie(res);
        return res;
      }

      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);

      const messageHash = createHash("sha256")
        .update(SIGN_MESSAGE_PREFIX + expectedMessage)
        .digest();

      const signatureBytes = Buffer.from(signature, "base64");

      isValid = keypair.verify(messageHash, signatureBytes);
    } catch {
      await applyAuthFailureDelay();
      const res = apiError("Error de autenticación: firma inválida", 401);
      clearWalletNonceCookie(res);
      return res;
    }

    if (!isValid) {
      await applyAuthFailureDelay();
      const res = apiError("Error de autenticación: firma inválida", 401);
      clearWalletNonceCookie(res);
      return res;
    }

    let user = await prisma.user.findFirst({
      where: { wallet_address: publicKey },
    });
    // Registro automático si el usuario no existe
    if (!user) {
      const hardcodedUser =
        process.env.NODE_ENV === "development"
          ? TEST_USERS.find((testUser) => testUser.wallet_address === publicKey)
          : undefined;

      if (hardcodedUser) {
        user = await prisma.user.create({
          data: {
            name: hardcodedUser.name,
            wallet_address: hardcodedUser.wallet_address,
            type: hardcodedUser.type,
            status: hardcodedUser.status,
          },
        });
      } else {
        const shortKey = `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`;

        user = await prisma.user.create({
          data: {
            name: `Wallet ${shortKey}`,
            wallet_address: publicKey,
            type: "user",
            status: "active",
          },
        });
      }
    }

    if (user.status !== "active") {
      const res = apiError("Cuenta suspendida", 403);
      clearWalletNonceCookie(res);
      return res;
    }

    const role = normalizeUserRole(user.type);
    if (!role) {
      const res = apiError(
        "Error de autenticación: rol de cuenta no válido; contacte al administrador",
        403
      );
      clearWalletNonceCookie(res);
      return res;
    }
    const redirectTo = role === "admin" ? "/admin/dashboard" : "/dashboard";
    const credential = await prisma.credential.findFirst({
      where: { user_id: user.user_id },
      select: { username: true },
    });

    const responseBody: AuthResponse = {
      message: "Inicio de sesión exitoso",
      redirectTo,
      role,
      user: toPublicUserDTO(user, credential?.username ?? null),
    };

    try {
      const token = await createSessionToken({
        userId: user.user_id,
        role,
      });
      const res = apiSuccess(responseBody);
      clearWalletNonceCookie(res);
      attachSessionCookie(res, token);
      return res;
    } catch {
      const res = apiError(
        "Error de autenticación: servidor sin AUTH_SECRET válido",
        500
      );
      clearWalletNonceCookie(res);
      return res;
    }
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/wallet-login]",
      err
    );
    if (infra) {
      clearWalletNonceCookie(infra);
      return infra;
    }
    const res = apiError("Error de autenticación: error interno", 500);
    clearWalletNonceCookie(res);
    return res;
  }
}
