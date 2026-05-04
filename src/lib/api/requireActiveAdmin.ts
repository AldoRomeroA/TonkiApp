import prisma from "src/lib/db";
import { apiError } from "src/lib/api/response";
import { getSessionUserId } from "src/lib/auth/session";

/**
 * Sesión válida + usuario activo en BD con `type === "admin"` (fuente de verdad para escritura).
 */
export async function requireActiveAdminSession() {
  const userId = await getSessionUserId();
  if (!userId) {
    return { ok: false as const, response: apiError("No autenticado", 401) };
  }

  const user = await prisma.user.findUnique({
    where: { user_id: userId },
  });

  if (!user || user.status !== "active") {
    return { ok: false as const, response: apiError("Cuenta suspendida", 403) };
  }

  if (user.type !== "admin") {
    return { ok: false as const, response: apiError("Prohibido", 403) };
  }

  return { ok: true as const, userId };
}
