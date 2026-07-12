// app/api/auth/wallet-register/route.ts
import prisma from "src/lib/db";
import { parseRequestJson } from "src/lib/api/readJsonSafely";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import { walletRegisterSchema } from "src/lib/auth/schemas";
import {
  attachSessionCookie,
  createSessionToken,
} from "src/lib/auth/session";
import type { AuthResponse } from "src/types/auth";
import { normalizeUserRole } from "src/lib/auth/userRole";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import {
  ageFromBirthDate,
  clearWalletPendingCookie,
  defaultNameFromEmail,
  getWalletPendingFromCookies,
} from "src/lib/auth/walletPendingRegistration";

const MIN_AGE = 13;
const MAX_AGE = 120;

export async function POST(req: Request) {
  try {
    const pending = await getWalletPendingFromCookies();
    if (!pending) {
      return apiError(
        "Sesión de registro expirada. Vuelve a conectar tu wallet.",
        401
      );
    }

    const raw = await parseRequestJson(req);
    if (raw === null) {
      return apiError("Error de registro: cuerpo JSON inválido", 400);
    }

    const parsed = walletRegisterSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "datos incompletos";
      return apiError(`Error de registro: ${first}`, 400);
    }

    const { email, birthDate: birthDateRaw, name: nameRaw } = parsed.data;
    const emailNormalized = email.toLowerCase();

    const [y, m, d] = birthDateRaw.split("-").map(Number);
    const birthDate = new Date(Date.UTC(y!, m! - 1, d!));
    const age = ageFromBirthDate(birthDate);

    if (age < MIN_AGE) {
      return apiError(
        `Error de registro: debes tener al menos ${MIN_AGE} años`,
        400
      );
    }
    if (age > MAX_AGE) {
      return apiError("Error de registro: fecha de nacimiento inválida", 400);
    }

    const existingWallet = await prisma.user.findFirst({
      where: { wallet_address: pending.publicKey },
      select: { user_id: true },
    });
    if (existingWallet) {
      const res = apiError(
        "Esta wallet ya está registrada. Intenta iniciar sesión de nuevo.",
        409
      );
      clearWalletPendingCookie(res);
      return res;
    }

    const name =
      nameRaw?.trim() ||
      defaultNameFromEmail(emailNormalized);

    const user = await prisma.user.create({
      data: {
        name,
        email: emailNormalized,
        birth_date: birthDate,
        age,
        wallet_address: pending.publicKey,
        type: "user",
        status: "active",
      },
    });

    const role = normalizeUserRole(user.type);
    if (!role) {
      const res = apiError(
        "Error de registro: rol de cuenta no válido",
        500
      );
      clearWalletPendingCookie(res);
      return res;
    }

    const redirectTo = role === "admin" ? "/admin/dashboard" : "/dashboard";
    const responseBody: AuthResponse = {
      message: "Registro exitoso",
      redirectTo,
      role,
      user: toPublicUserDTO(user, null),
    };

    try {
      const token = await createSessionToken({
        userId: user.user_id,
        role,
      });
      const res = apiSuccess(responseBody);
      clearWalletPendingCookie(res);
      attachSessionCookie(res, token);
      return res;
    } catch {
      const res = apiError(
        "Error de registro: servidor sin AUTH_SECRET válido",
        500
      );
      clearWalletPendingCookie(res);
      return res;
    }
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/wallet-register]",
      err
    );
    if (infra) {
      clearWalletPendingCookie(infra);
      return infra;
    }
    const res = apiError("Error de registro: error interno", 500);
    clearWalletPendingCookie(res);
    return res;
  }
}
