import { z } from "zod";

import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { getSessionFromCookies } from "src/lib/auth/session";

const postIdParamSchema = z.string().uuid();

export async function POST(
  _req: Request,
  context: { params: Promise<{ postId: string }> }
) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return apiError("No autenticado", 401);
    }

    const account = await prisma.user.findUnique({
      where: { user_id: session.userId },
      select: { status: true },
    });
    if (!account || account.status !== "active") {
      return apiError("Cuenta suspendida", 403);
    }

    const { postId } = await context.params;
    const pid = postIdParamSchema.safeParse(postId);
    if (!pid.success) {
      return apiError("Post inválido", 400);
    }

    // Incrementar vistas sin tocar `updated_at`: un `post.update` dispara @updatedAt
    // y haría que todo el feed marque "Editado" tras la primera vista.
    const affected = await prisma.$executeRaw`
      UPDATE \`Post\` SET \`view_count\` = \`view_count\` + 1 WHERE \`post_id\` = ${pid.data}
    `;
    const rowsTouched =
      typeof affected === "bigint" ? Number(affected) : affected;
    if (!Number.isFinite(rowsTouched) || rowsTouched === 0) {
      return apiError("Publicación no encontrada", 404);
    }

    const row = await prisma.post.findUnique({
      where: { post_id: pid.data },
      select: { view_count: true },
    });

    return apiSuccess({ view_count: row?.view_count ?? 0 });
  } catch {
    return apiError("Error al registrar vista", 500);
  }
}
