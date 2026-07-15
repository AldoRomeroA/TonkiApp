import { randomUUID } from "crypto";

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

export async function POST(req: Request) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const establishment = await prisma.establishment.findFirst({
      where: { admin_id: gate.userId },
      orderBy: { created_at: "asc" },
      select: { establishment_id: true, name: true },
    });
    if (!establishment) {
      return apiError(
        "No tienes un establecimiento configurado para publicar recompensas",
        400
      );
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

    const establishment_reward_id = randomUUID();

    let image_url: string | null = null;
    if (imageFile) {
      try {
        const saved = await saveEstablishmentRewardImage(
          imageFile,
          establishment_reward_id
        );
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
      INSERT INTO Establishment_Reward (
        establishment_reward_id,
        establishment_id,
        admin_id,
        title,
        short_description,
        long_description,
        image_url,
        value_tonkis,
        value_usd,
        created_at,
        updated_at
      ) VALUES (
        ${establishment_reward_id},
        ${establishment.establishment_id},
        ${gate.userId},
        ${title},
        ${short_description},
        ${long_description},
        ${image_url},
        ${value_tonkis},
        ${value_usd},
        NOW(3),
        NOW(3)
      )
    `;

    const item: EstablishmentRewardCatalogItem = {
      id: establishment_reward_id,
      title,
      short_description,
      long_description,
      image_url,
      value_tonkis,
      value_usd,
      establishment_id: establishment.establishment_id,
      establishment_name: establishment.name,
    };

    return apiSuccess({
      message: "Recompensa creada",
      reward: item,
    });
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/rewards/catalog POST]",
      err
    );
    if (infra) return infra;
    return apiError("Error al crear la recompensa", 500);
  }
}
