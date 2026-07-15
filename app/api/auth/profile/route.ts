import prisma from "src/lib/db";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import { apiError, apiSuccess } from "src/lib/api/response";
import { composeDisplayName, toPublicUserDTO } from "src/lib/auth/dto";
import {
  AvatarUploadError,
  saveAvatarUpload,
} from "src/lib/auth/saveAvatarUpload";
import { profileUpdateSchema } from "src/lib/auth/schemas";
import { verifySession } from "src/lib/auth/session";
import { normalizeUserRole } from "src/lib/auth/userRole";
import { ageFromBirthDate } from "src/lib/auth/walletPendingRegistration";

const MIN_AGE = 13;
const MAX_AGE = 120;

export async function PATCH(req: Request) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return apiError("No autenticado", 401);
    }
    const { userId } = session;

    const existing = await prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!existing) {
      return apiError("No autenticado", 401);
    }
    if (existing.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const role = normalizeUserRole(existing.type);
    if (!role) {
      return apiError("Cuenta con rol no válido", 403);
    }
    const isAdmin = role === "admin";

    const contentType = req.headers.get("content-type") ?? "";
    let email: string;
    let first_name: string;
    let paternal_surname = "";
    let maternal_surname = "";
    let birthDateRaw: string;
    let avatarFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const raw = {
        email: String(form.get("email") ?? ""),
        first_name: String(form.get("first_name") ?? ""),
        paternal_surname: String(form.get("paternal_surname") ?? ""),
        maternal_surname: String(form.get("maternal_surname") ?? ""),
        birthDate: String(form.get("birthDate") ?? ""),
      };
      const parsed = profileUpdateSchema.safeParse(raw);
      if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return apiError(first, 400);
      }
      email = parsed.data.email;
      first_name = parsed.data.first_name;
      paternal_surname = parsed.data.paternal_surname;
      maternal_surname = parsed.data.maternal_surname;
      birthDateRaw = parsed.data.birthDate;

      const maybeAvatar = form.get("avatar");
      if (maybeAvatar instanceof File && maybeAvatar.size > 0) {
        avatarFile = maybeAvatar;
      }
    } else {
      let json: unknown;
      try {
        json = await req.json();
      } catch {
        return apiError("Cuerpo inválido", 400);
      }
      const parsed = profileUpdateSchema.safeParse(json);
      if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return apiError(first, 400);
      }
      email = parsed.data.email;
      first_name = parsed.data.first_name;
      paternal_surname = parsed.data.paternal_surname;
      maternal_surname = parsed.data.maternal_surname;
      birthDateRaw = parsed.data.birthDate;
    }

    const [y, m, d] = birthDateRaw.split("-").map(Number);
    const birthDate = new Date(Date.UTC(y!, m! - 1, d!));
    const age = ageFromBirthDate(birthDate);

    if (age < MIN_AGE) {
      return apiError(`Debes tener al menos ${MIN_AGE} años`, 400);
    }
    if (age > MAX_AGE) {
      return apiError("Fecha de nacimiento inválida", 400);
    }

    let avatar_url = existing.avatar_url;
    if (avatarFile) {
      try {
        const saved = await saveAvatarUpload(avatarFile, userId);
        avatar_url = saved.url;
      } catch (err) {
        if (err instanceof AvatarUploadError) {
          return apiError(err.message, 400);
        }
        throw err;
      }
    }

    const storedPaternal = isAdmin
      ? null
      : paternal_surname.length > 0
        ? paternal_surname
        : null;
    const storedMaternal = isAdmin
      ? null
      : maternal_surname.length > 0
        ? maternal_surname
        : null;

    const displayName = isAdmin
      ? first_name.slice(0, 100)
      : composeDisplayName(first_name, storedPaternal, storedMaternal);

    const user = await prisma.user.update({
      where: { user_id: userId },
      data: {
        email: email.toLowerCase(),
        first_name,
        paternal_surname: storedPaternal,
        maternal_surname: storedMaternal,
        name: displayName,
        birth_date: birthDate,
        age,
        avatar_url,
      },
    });

    const credential = await prisma.credential.findFirst({
      where: { user_id: user.user_id },
      select: { username: true },
    });

    return apiSuccess({
      message: "Perfil actualizado",
      user: toPublicUserDTO(user, credential?.username ?? null),
      role,
    });
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/profile]",
      err
    );
    if (infra) return infra;
    return apiError("Error al actualizar el perfil", 500);
  }
}
