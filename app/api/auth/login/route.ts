// app/api/auth/login/route.ts
import prisma from "src/lib/db";
import bcrypt from "bcrypt";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import {
  passwordLoginSchema,
  type PasswordLoginInput,
} from "src/lib/auth/schemas";
import {
  attachSessionCookie,
  createSessionToken,
} from "src/lib/auth/session";
import { applyAuthFailureDelay } from "src/lib/auth/security";
import type { AuthResponse, UserRole } from "src/types/auth";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";

export async function POST(req: Request) {
  try {
    let body: PasswordLoginInput;
    try {
      body = (await req.json()) as PasswordLoginInput;
    } catch {
      return apiError("Error de autenticación: cuerpo JSON inválido", 400);
    }

    const parsed = passwordLoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Error de autenticación: datos incompletos", 400);
    }
    const { username, password } = parsed.data;

    const credential = await prisma.credential.findFirst({
      where: {
        OR: [{ username }, { user: { email: username } }],
      },
      include: { user: true },
    });

    if (!credential) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticación: credenciales inválidas", 401);
    }

    if (!credential.password_hash) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticación: credenciales inválidas", 401);
    }

    const isValid = await bcrypt.compare(password, credential.password_hash);

    if (!isValid) {
      await applyAuthFailureDelay();
      return apiError("Error de autenticación: credenciales inválidas", 401);
    }

    if (credential.user.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const role = credential.user.type as UserRole;
    const redirectTo = role === "admin" ? "/admin/dashboard" : "/dashboard";

    const responseBody: AuthResponse = {
      message: "Inicio de sesión exitoso",
      user: toPublicUserDTO(credential.user, credential.username),
      role,
      redirectTo,
    };

    try {
      const token = await createSessionToken({
        userId: credential.user.user_id,
        role,
      });
      const res = apiSuccess(responseBody);
      attachSessionCookie(res, token);
      return res;
    } catch {
      return apiError(
        "Error de autenticación: servidor sin AUTH_SECRET válido",
        500
      );
    }
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/login]",
      err
    );
    if (infra) return infra;
    return apiError("Error de autenticación: error interno", 500);
  }
}
