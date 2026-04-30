// app/api/auth/login/route.ts
import prisma from "src/lib/db";
import bcrypt from "bcrypt";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import {
  passwordLoginSchema,
  type PasswordLoginInput,
} from "src/lib/auth/schemas";
import { applyAuthFailureDelay } from "src/lib/auth/security";
import type { AuthResponse, UserRole } from "src/types/auth";

export async function POST(req: Request) {
  try {
    let body: PasswordLoginInput;
    try {
      body = (await req.json()) as PasswordLoginInput;
    } catch {
      return apiError("Error de autenticacion: cuerpo JSON invalido", 400);
    }

    const parsed = passwordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Error de autenticacion: datos incompletos", 400);
    }
    const { username, password } = parsed.data;

    const credential = await prisma.credential.findUnique({
      where: { username },
      include: { user: true },
    });

    if (!credential) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticacion: credenciales invalidas", 401);
    }

    if (!credential.password_hash) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticacion: credenciales invalidas", 401);
    }

    const isValid = await bcrypt.compare(password, credential.password_hash);

    if (!isValid) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticacion: credenciales invalidas", 401);
    }

    const role = credential.user.type as UserRole;
    const redirectTo = role === "admin" ? "/admin/dashboard" : "/dashboard";
    const responseBody: AuthResponse = {
      message: "Inicio de sesion exitoso",
      user: toPublicUserDTO(credential.user, credential.username),
      redirectTo,
    };

    return apiSuccess(responseBody);
  } catch {
    return apiError("Error de autenticacion: error interno", 500);
  }
}