import { randomUUID } from "crypto";

import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import {
  normalizeAirdropAssetCode,
  type AirdropAssetCode,
} from "src/lib/airdrop/constants";
import {
  airdropConfigBodySchema,
  parseAirdropScheduledDate,
  parseAirdropScheduledDateEnd,
} from "src/lib/airdrop/schemas";

function serializeConfig(config: {
  amount: number;
  asset: string;
  scheduled_date: Date;
  scheduled_end_date: Date | null;
  periodicity_months: number;
  max_users: number;
}) {
  return {
    amount: config.amount,
    asset: normalizeAirdropAssetCode(config.asset) as AirdropAssetCode,
    scheduled_date: config.scheduled_date.toISOString(),
    scheduled_end_date: config.scheduled_end_date?.toISOString() ?? null,
    periodicity_months: config.periodicity_months,
    max_users: config.max_users,
  };
}

const CONFIG_SELECT = {
  amount: true,
  asset: true,
  scheduled_date: true,
  scheduled_end_date: true,
  periodicity_months: true,
  max_users: true,
} as const;

export async function GET() {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const config = await prisma.airdropConfig.findFirst({
      where: { user_id: gate.userId },
      orderBy: { created_at: "desc" },
      select: CONFIG_SELECT,
    });

    return apiSuccess({
      config: config ? serializeConfig(config) : null,
    });
  } catch {
    return apiError("Error al cargar la configuración", 500);
  }
}

export async function POST(req: Request) {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return apiError("Cuerpo JSON inválido", 400);
    }

    const parsed = airdropConfigBodySchema.safeParse(json);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
      return apiError(msg, 400);
    }

    const {
      amount,
      asset,
      scheduled_date,
      scheduled_end_date,
      periodicity_months,
      max_users,
    } = parsed.data;
    const scheduledDate = parseAirdropScheduledDate(scheduled_date);
    const scheduledEndDate = parseAirdropScheduledDateEnd(scheduled_end_date);

    const existing = await prisma.airdropConfig.findFirst({
      where: { user_id: gate.userId },
      orderBy: { created_at: "desc" },
    });

    const row = existing
      ? await prisma.airdropConfig.update({
          where: { config_id: existing.config_id },
          data: {
            amount,
            asset,
            scheduled_date: scheduledDate,
            scheduled_end_date: scheduledEndDate,
            periodicity_months,
            max_users,
          },
          select: CONFIG_SELECT,
        })
      : await prisma.airdropConfig.create({
          data: {
            config_id: randomUUID(),
            user_id: gate.userId,
            amount,
            asset,
            scheduled_date: scheduledDate,
            scheduled_end_date: scheduledEndDate,
            periodicity_months,
            max_users,
          },
          select: CONFIG_SELECT,
        });

    return apiSuccess({
      message: "Configuración guardada",
      config: serializeConfig(row),
    });
  } catch {
    return apiError("Error al guardar la configuración", 500);
  }
}
