// app/api/auth/wallet-login/route.ts
import { NextResponse } from "next/server";
import prisma from "src/lib/db";
import * as StellarSdk from "@stellar/stellar-sdk";
import { createHash } from "crypto";

const CHALLENGE = "Login con TonkiApp";
const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { publicKey, signature } = body;

    if (!publicKey || !signature) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    let isValid = false;
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);

      // Reconstrucción del hash del mensaje que se firmó originalmente
      const messageHash = createHash("sha256")
        .update(SIGN_MESSAGE_PREFIX + CHALLENGE)
        .digest();

      const signatureBytes = Buffer.from(signature, "base64");

      // Verificación de la firma usando la llave pública
      isValid = keypair.verify(messageHash, signatureBytes);
    } catch (err) {
      console.error("❌ Error en verificación:", err);
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    if (!isValid) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    let user = await prisma.user.findFirst({
      where: { wallet_address: publicKey },
    });
    // Registro automático si el usuario no existe
    if (!user) {
      const shortKey = `${publicKey.slice(0, 6)}…${publicKey.slice(-4)}`;

      user = await prisma.user.create({
        data: {
          name: `Wallet ${shortKey}`,
          wallet_address: publicKey,
          type: "user",
          status: "active",
          // Nota: falta la parte de email
        },
      });
    }
    // Lógica de reenvio basada en el rol
    const redirectTo =
      user.type === "admin" ? "/admin/dashboard" : "/dashboard";

    return NextResponse.json({
      message: "Login con wallet exitoso",
      redirectTo,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email ?? null,
        wallet: user.wallet_address,
        type: user.type,
        status: user.status,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Error interno", status: 500 });
  }
}
