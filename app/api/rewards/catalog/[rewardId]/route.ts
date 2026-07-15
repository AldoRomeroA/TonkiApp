import prisma from "src/lib/db";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { apiError, apiSuccess } from "src/lib/api/response";
import { establishmentRewardUpdateSchema } from "src/lib/rewards/schemas";
import {
  RewardImageUploadError,
  saveEstablishmentRewardImage,
} from "src/lib/rewards/saveEstablishmentRewardImage";
import type { EstablishmentRewardCatalogItem } from "src/lib/rewards/types";

type RouteContext = {
  params: Promise<{ rewardId: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const { rewardId } = await context.params;
    if (!rewardId?.trim()) {
      return apiError("Recompensa no válida", 400);
    }

    const existing = await prisma.$queryRaw<
      Array<{
        establishment_reward_id: string;
        image_url: string | null;
        establishment_id: string;
        establishment_name: string;
      }>
    >`
      SELECT
        er.establishment_reward_id,
        er.image_url,
        er.establishment_id,
        e.name AS establishment_name
      FROM Establishment_Reward er
      INNER JOIN Establishment e
        ON e.establishment_id = er.establishment_id
      WHERE er.establishment_reward_id = ${rewardId}
        AND er.admin_id = ${gate.userId}
      LIMIT 1
    `;

    if (existing.length === 0) {
      return apiError("Recompensa no encontrada", 404);
    }

    const contentType = req.headers.get("content-type") ?? "";
    let raw: Record<string, unknown>;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      raw = {
        title: String(form.get("title") ?? ""),
        short_description: String(form.get("short_description") ?? ""),
        long_description: String(form.get("long_description") ?? ""),
        value_tonkis: String(form.get("value_tonkis") ?? ""),
        value_usd: String(form.get("value_usd") ?? ""),
      };
      const maybeImage = form.get("image");
      if (maybeImage instanceof File && maybeImage.size > 0) {
        imageFile = maybeImage;
      }
    } else {
      try {
        raw = (await req.json()) as Record<string, unknown>;
      } catch {
        return apiError("Cuerpo inválido", 400);
      }
    }

    const parsed = establishmentRewardUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
      return apiError(first, 400);
    }

    let image_url = existing[0]!.image_url;
    if (imageFile) {
      try {
        const saved = await saveEstablishmentRewardImage(imageFile, rewardId);
        image_url = saved.url;
      } catch (err) {
        if (err instanceof RewardImageUploadError) {
          return apiError(err.message, 400);
        }
        throw err;
      }
    }

    const { title, short_description, long_description, value_tonkis, value_usd } =
      parsed.data;

    await prisma.$executeRaw`
      UPDATE Establishment_Reward
      SET
        title = ${title},
        short_description = ${short_description},
        long_description = ${long_description},
        value_tonkis = ${value_tonkis},
        value_usd = ${value_usd},
        image_url = ${image_url},
        updated_at = NOW(3)
      WHERE establishment_reward_id = ${rewardId}
        AND admin_id = ${gate.userId}
    `;

    const item: EstablishmentRewardCatalogItem = {
      id: rewardId,
      title,
      short_description,
      long_description,
      image_url: image_url?.trim() || null,
      value_tonkis,
      value_usd,
      establishment_id: existing[0]!.establishment_id,
      establishment_name: existing[0]!.establishment_name,
    };

    return apiSuccess({
      message: "Recompensa actualizada",
      reward: item,
    });
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/rewards/catalog/[rewardId]]",
      err
    );
    if (infra) return infra;
    return apiError("Error al actualizar la recompensa", 500);
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const { rewardId } = await context.params;
    if (!rewardId?.trim()) {
      return apiError("Recompensa no válida", 400);
    }

    const result = await prisma.$executeRaw`
      DELETE FROM Establishment_Reward
      WHERE establishment_reward_id = ${rewardId}
        AND admin_id = ${gate.userId}
    `;

    if (Number(result) === 0) {
      return apiError("Recompensa no encontrada", 404);
    }

    return apiSuccess({
      message: "Recompensa eliminada",
      id: rewardId,
    });
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/rewards/catalog/[rewardId] DELETE]",
      err
    );
    if (infra) return infra;
    return apiError("Error al eliminar la recompensa", 500);
  }
}
