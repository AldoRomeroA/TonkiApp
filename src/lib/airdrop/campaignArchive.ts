import { randomUUID } from "crypto";

import prisma from "src/lib/db";
import {
  parseAirdropScheduledDate,
  parseAirdropScheduledDateEnd,
} from "src/lib/airdrop/schemas";

type CampaignMetrics = {
  visitors_count: number;
  purchase_count: number;
  total_spent: number;
};

async function computeEstablishmentMetrics(
  establishmentId: string,
  campaignStart: Date,
  campaignEnd: Date
): Promise<CampaignMetrics> {
  const rewards = await prisma.reward.findMany({
    where: {
      establishment_id: establishmentId,
      created_at: {
        gte: campaignStart,
        lte: campaignEnd,
      },
    },
    select: {
      user_id: true,
      points: true,
    },
  });

  const visitors = new Set(rewards.map((r) => r.user_id));
  const totalSpent = rewards.reduce((sum, r) => sum + r.points, 0);

  return {
    visitors_count: visitors.size,
    purchase_count: rewards.length,
    total_spent: totalSpent,
  };
}

async function resolveAirdropDelivery(configId: string, fallbackAmount: number) {
  const log = await prisma.airdropLog.findFirst({
    where: { config_id: configId, success: true },
    orderBy: { executed_at: "desc" },
    select: {
      total_amount: true,
      users_involved: true,
    },
  });

  if (log) {
    return {
      balance_sent: log.total_amount,
      users_sent: log.users_involved,
    };
  }

  return {
    balance_sent: fallbackAmount,
    users_sent: 0,
  };
}

/** Archiva campañas finalizadas del admin que aún no tienen registro. */
export async function archiveEndedCampaigns(adminId: string): Promise<void> {
  const now = new Date();

  const configs = await prisma.airdropConfig.findMany({
    where: {
      user_id: adminId,
      scheduled_end_date: { not: null, lte: now },
      archives: { none: {} },
    },
    select: {
      config_id: true,
      amount: true,
      scheduled_date: true,
      scheduled_end_date: true,
    },
  });

  if (configs.length === 0) return;

  const establishment = await prisma.establishment.findFirst({
    where: { admin_id: adminId },
    select: { establishment_id: true },
  });

  for (const config of configs) {
    if (!config.scheduled_end_date) continue;

    const campaignStart = parseAirdropScheduledDate(
      config.scheduled_date.toISOString().slice(0, 10)
    );
    const campaignEnd = parseAirdropScheduledDateEnd(
      config.scheduled_end_date.toISOString().slice(0, 10)
    );

    const metrics = establishment
      ? await computeEstablishmentMetrics(
          establishment.establishment_id,
          campaignStart,
          campaignEnd
        )
      : { visitors_count: 0, purchase_count: 0, total_spent: 0 };

    const delivery = await resolveAirdropDelivery(config.config_id, config.amount);

    await prisma.airdropCampaignArchive.create({
      data: {
        archive_id: randomUUID(),
        config_id: config.config_id,
        admin_id: adminId,
        establishment_id: establishment?.establishment_id ?? null,
        campaign_start: campaignStart,
        campaign_end: campaignEnd,
        balance_sent: delivery.balance_sent,
        users_sent: delivery.users_sent,
        visitors_count: metrics.visitors_count,
        purchase_count: metrics.purchase_count,
        total_spent: metrics.total_spent,
      },
    });
  }
}

export function serializeCampaignArchive(row: {
  archive_id: string;
  campaign_start: Date;
  campaign_end: Date;
  balance_sent: number;
  users_sent: number;
  visitors_count: number;
  purchase_count: number;
  total_spent: number;
  archived_at: Date;
}) {
  return {
    archive_id: row.archive_id,
    campaign_start: row.campaign_start.toISOString(),
    campaign_end: row.campaign_end.toISOString(),
    balance_sent: row.balance_sent,
    users_sent: row.users_sent,
    visitors_count: row.visitors_count,
    purchase_count: row.purchase_count,
    total_spent: row.total_spent,
    archived_at: row.archived_at.toISOString(),
  };
}
