import { NextResponse } from "next/server";
import prisma from "src/lib/db";
import * as StellarSdk from "@stellar/stellar-sdk";

export async function POST(req: Request) {
  try {
    const { publicKey, signature } = await req.json();

    if (!publicKey || !signature) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    // 1. Buscar usuario por wallet_address
    const user = await prisma.user.findFirst({
        where: { wallet_address: publicKey },
    });

    if (!user) {
      return NextResponse.json({ error: "Wallet no registrada" }, { status: 404 });
    }

    // 2. Verificar firma
    const challenge = "Login con TonkiApp"; // luego lo hacemos dinámico
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);

    let isValid = false;
    try {
      isValid = keypair.verify(
        Buffer.from(challenge),
        Buffer.from(signature, "base64")
      );
    } catch (err) {
      console.error("Error verificando firma:", err);
    }

    if (!isValid) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    // 3. Responder con datos del usuario
    return NextResponse.json({
      message: "Login con wallet exitoso",
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        wallet: user.wallet_address,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}