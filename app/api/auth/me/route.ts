import prisma from "src/lib/db";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import { apiError, apiSuccess } from "src/lib/api/response";
import { toPublicUserDTO } from "src/lib/auth/dto";
import { verifySession } from "src/lib/auth/session";
import { normalizeUserRole } from "src/lib/auth/userRole";

export async function GET(req: Request) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return apiError("No autenticado", 401);
    }
    const { userId } = session;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });
    if (!user) {
      return apiError("No autenticado", 401);
    }

    if (user.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const credential = await prisma.credential.findFirst({
      where: { user_id: user.user_id },
      select: { username: true },
    });

    const role = normalizeUserRole(user.type);
    if (!role) {
      return apiError("Cuenta con rol no válido", 403);
    }

    return apiSuccess({
      user: toPublicUserDTO(user, credential?.username ?? null),
      role,
    });
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError("[api/auth/me]", err);
    if (infra) return infra;
    return apiError("Error al cargar el perfil", 500);
  }
}
