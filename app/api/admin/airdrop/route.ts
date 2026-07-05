import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";

export async function GET() {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;
    const userId = gate.userId;

    const [totalPointsAgg, config, adminUser] = await Promise.all([
      prisma.reward.aggregate({ _sum: { points: true } }),
      prisma.airdropConfig.findFirst({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
      }),
      prisma.user.findUnique({
        where: { user_id: userId },
        select: { wallet_address: true },
      }),
    ]);

    const totalPoints = totalPointsAgg._sum.points ?? 0;
    const limit =
      config?.max_users && config.max_users > 0 ? config.max_users : 10;

    const grouped = await prisma.reward.groupBy({
      by: ["user_id"],
      _sum: { points: true },
    });

    const eligibleIds = grouped
      .filter((row) => (row._sum.points ?? 0) >= 1)
      .map((row) => row.user_id);

    const nonAdminUsers = await prisma.user.findMany({
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

    const users = nonAdminUsers
      .map((user) => {
        const tonkis = pointsByUser.get(user.user_id) ?? 0;
        return {
          user_id: user.user_id,
          name: user.name,
          wallet_address: user.wallet_address,
          tonkis,
          fund_percent:
            totalPoints > 0 ? (tonkis * 100) / totalPoints : 0,
        };
      })
      .filter((row) => row.tonkis >= 1)
      .sort((a, b) => b.tonkis - a.tonkis)
      .slice(0, limit);

    return apiSuccess({
      amount: config?.amount ?? 0,
      source_public_key: adminUser?.wallet_address ?? null,
      scheduled_date: config?.scheduled_date?.toISOString() ?? null,
      scheduled_end_date: config?.scheduled_end_date?.toISOString() ?? null,
      max_users: config?.max_users ?? 0,
      periodicity_months: config?.periodicity_months ?? 0,
      users,
    });
  } catch {
    return apiError("Error al cargar el airdrop", 500);
  }
}
