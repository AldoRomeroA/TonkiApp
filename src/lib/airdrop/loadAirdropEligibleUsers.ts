import prisma from "src/lib/db";

import {
  normalizeAirdropAssetCode,
  type AirdropAssetCode,
} from "src/lib/airdrop/constants";
import {
  applyAirdropSharePercents,
  type AirdropEligibleInput,
} from "src/lib/airdrop/eligibleUsers";
import type { AirdropUserRow } from "src/lib/airdrop/types";

export type AirdropConfigSnapshot = {
  config_id: string;
  amount: number;
  asset: AirdropAssetCode;
  max_users: number;
  scheduled_date: Date;
  scheduled_end_date: Date | null;
  periodicity_months: number;
};

/**
 * Same eligible list the airdrop page shows: non-admin users with ≥1 tonki,
 * capped by config.max_users, ordered by tonkis desc, with 98%-pool shares.
 */
export async function loadAirdropEligibleUsers(adminUserId: string): Promise<{
  config: AirdropConfigSnapshot | null;
  sourcePublicKey: string | null;
  users: AirdropUserRow[];
}> {
  const [config, adminUser, grouped] = await Promise.all([
    prisma.airdropConfig.findFirst({
      where: { user_id: adminUserId },
      orderBy: { created_at: "desc" },
    }),
    prisma.user.findUnique({
      where: { user_id: adminUserId },
      select: { wallet_address: true },
    }),
    prisma.reward.groupBy({
      by: ["user_id"],
      _sum: { points: true },
    }),
  ]);

  const limit =
    config?.max_users && config.max_users > 0 ? config.max_users : 10;

  const eligibleIds = grouped
    .filter((row) => (row._sum.points ?? 0) >= 1)
    .map((row) => row.user_id);

  const nonAdminUsers =
    eligibleIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: {
            user_id: { in: eligibleIds },
            type: { not: "admin" },
          },
          select: {
            user_id: true,
            name: true,
            wallet_address: true,
          },
        });

  const pointsByUser = new Map(
    grouped.map((row) => [row.user_id, row._sum.points ?? 0])
  );

  const ranked: AirdropEligibleInput[] = nonAdminUsers
    .map((user) => ({
      user_id: user.user_id,
      name: user.name,
      wallet_address: user.wallet_address,
      tonkis: pointsByUser.get(user.user_id) ?? 0,
    }))
    .filter((row) => row.tonkis >= 1)
    .sort((a, b) => b.tonkis - a.tonkis)
    .slice(0, limit);

  const users = applyAirdropSharePercents(ranked);

  return {
    config: config
      ? {
          config_id: config.config_id,
          amount: config.amount,
          asset: normalizeAirdropAssetCode(config.asset),
          max_users: config.max_users,
          scheduled_date: config.scheduled_date,
          scheduled_end_date: config.scheduled_end_date,
          periodicity_months: config.periodicity_months,
        }
      : null,
    sourcePublicKey: adminUser?.wallet_address ?? null,
    users,
  };
}
