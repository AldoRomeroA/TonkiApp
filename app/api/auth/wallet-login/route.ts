// app/api/auth/wallet-login/route.ts
import prisma from "src/lib/db";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createHash } from "crypto";
import { AUTH_CHALLENGE } from "src/lib/auth/constants";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import {
  walletLoginSchema,
  type WalletLoginInput,
} from "src/lib/auth/schemas";
import type { AuthResponse, UserRole } from "src/types/auth";

const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

export async function POST(req: Request) {
  try {
    let body: WalletLoginInput;
    try {
      body = (await req.json()) as WalletLoginInput;
    } catch {
      return apiError("Error de autenticacion: cuerpo JSON invalido", 400);
    }

    const parsed = walletLoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Error de autenticacion: datos incompletos", 400);
    }
    const { publicKey, signature } = parsed.data;

    let isValid = false;
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);

      // Reconstrucción del hash del mensaje que se firmó originalmente
      const messageHash = createHash("sha256")
        .update(SIGN_MESSAGE_PREFIX + AUTH_CHALLENGE)
        .digest();

      const signatureBytes = Buffer.from(signature, "base64");

      // Verificación de la firma usando la llave pública
      isValid = keypair.verify(messageHash, signatureBytes);
    } catch (err) {
      return apiError("Error de autenticacion: firma invalida", 401);
    }

    if (!isValid) {
      return apiError("Error de autenticacion: firma invalida", 401);
    }

    let user = await prisma.user.findFirst({
      where: { wallet_address: publicKey },
    });
    // Registro automático si el usuario no existe
    if (!user) {
      const shortKey = `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`;
      
      // TODO(wallet-onboarding):
      // 1) Crear un "perfil pendiente" con email opcional y estado "pending_profile".
      // 2) Generar y persistir un token de onboarding (TTL corto, un solo uso).
      // 3) Enviar email de verificación si el usuario provee correo en el primer paso.
      // 4) Exponer `redirectTo: "/onboarding"` hasta completar perfil.
      // 5) Marcar `status: "active"` solo cuando email y datos mínimos estén validados.
      // Referencia de implementación mínima:
      // - Tabla user_profile_onboarding(user_id, token, expires_at, consumed_at)
      // - Endpoint POST /api/auth/complete-profile para cerrar onboarding
      // - Validar token + wallet ownership antes de aceptar cambios

      user = await prisma.user.create({
        data: {
          name: `Wallet ${shortKey}`,
          wallet_address: publicKey,
          type: "user",
          status: "active",
        },
      });
    }
    // Lógica de reenvio basada en el rol
    const role = user.type as UserRole;
    const redirectTo = role === "admin" ? "/admin/dashboard" : "/dashboard";
    const credential = await prisma.credential.findFirst({
      where: { user_id: user.user_id },
      select: { username: true },
    });

    const responseBody: AuthResponse = {
      message: "Inicio de sesion exitoso",
      redirectTo,
      user: toPublicUserDTO(user, credential?.username ?? null),
    };

    return apiSuccess(responseBody);
  } catch {
    return apiError("Error de autenticacion: error interno", 500);
  }
}
