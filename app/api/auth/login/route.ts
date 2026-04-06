// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import prisma from 'src/lib/db';
import bcrypt from 'bcrypt';

export async function POST(req: Request) {
  const { username, password } = await req.json();

    const credential = await prisma.credential.findUnique({
    where: { username },
    include: { user: true },
    });

    if (!credential) {
    return new Response(JSON.stringify({ error: "Usuario no encontrado" }), { status: 404 });
    }

    if (!credential.password_hash) {
    return new Response(JSON.stringify({ error: "Credencial sin contraseña" }), { status: 400 });
    }

    const isValid = await bcrypt.compare(password, credential.password_hash);

    if (!isValid) {
    return new Response(JSON.stringify({ error: "Contraseña incorrecta" }), { status: 401 });
    }

  return NextResponse.json({
    message: 'Login exitoso',
    user: credential.user,
  });
}