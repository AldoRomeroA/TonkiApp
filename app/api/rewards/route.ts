import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import { verifySession } from "src/lib/auth/session";
import { normalizeUserRole } from "src/lib/auth/userRole";
import type {
  EstablishmentRewardCatalogItem,
  RewardsPagePayload,
  RewardsPodiumEntry,
} from "src/lib/rewards/types";

function displayFirstName(user: {
  first_name: string | null;
  name: string;
}): string {
  const first = user.first_name?.trim();
  if (first) return first;
  const full = user.name?.trim() || "";
  if (!full) return "Usuario";
  return full.split(/\s+/)[0] ?? full;
}

function greetingName(user: {
  first_name: string | null;
  name: string;
  email: string | null;
}): string {
  const first = user.first_name?.trim();
  if (first) return first;
  const full = user.name?.trim();
  if (full) return full;
  const emailLocal = user.email?.split("@")[0]?.trim();
  if (emailLocal) return emailLocal;
  return "Usuario";
}

function toPodium(
  rows: Array<{ id: string; name: string; points: number; avatar_url: string | null }>
): RewardsPodiumEntry[] {
  return rows.slice(0, 3).map((row, index) => ({
    rank: (index + 1) as 1 | 2 | 3,
    id: row.id,
    name: row.name,
    points: row.points,
    avatar_url: row.avatar_url,
  }));
}

async function loadAdminLeaderboard(
  adminUserId: string
): Promise<RewardsPodiumEntry[]> {
  const establishments = await prisma.establishment.findMany({
    where: { admin_id: adminUserId },
    select: { establishment_id: true },
  });
  const establishmentIds = establishments.map((e) => e.establishment_id);
  if (establishmentIds.length === 0) return [];

  const grouped = await prisma.reward.groupBy({
    by: ["user_id"],
    where: { establishment_id: { in: establishmentIds } },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 20,
  });

  if (grouped.length === 0) return [];

  const users = await prisma.user.findMany({
    where: {
      user_id: { in: grouped.map((g) => g.user_id) },
      type: { not: "admin" },
    },
    select: {
      user_id: true,
      first_name: true,
      name: true,
      avatar_url: true,
    },
  });
  const byId = new Map(users.map((u) => [u.user_id, u]));

  const rows = grouped
    .map((g) => {
      const user = byId.get(g.user_id);
      if (!user) return null;
      return {
        id: user.user_id,
        name: displayFirstName(user),
        points: g._sum.points ?? 0,
        avatar_url: user.avatar_url,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 3);

  return toPodium(rows);
}

async function loadUserConsumptions(
  userId: string
): Promise<RewardsPodiumEntry[]> {
  const grouped = await prisma.reward.groupBy({
    by: ["establishment_id"],
    where: { user_id: userId },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 3,
  });

  if (grouped.length === 0) return [];

  const ids = grouped.map((g) => g.establishment_id);
  const establishments = await prisma.establishment.findMany({
    where: { establishment_id: { in: ids } },
    select: { establishment_id: true, name: true },
  });
  const byId = new Map(
    establishments.map((e) => [
      e.establishment_id,
      {
        establishment_id: e.establishment_id,
        name: e.name,
        // Prefer DB avatar once Prisma client is regenerated with avatar_url.
        avatar_url: null as string | null,
      },
    ])
  );

  try {
    const { Prisma } = await import("src/generated/prisma/client");
    const withAvatars = await prisma.$queryRaw<
      Array<{ establishment_id: string; avatar_url: string | null }>
    >(
      Prisma.sql`SELECT establishment_id, avatar_url FROM Establishment WHERE establishment_id IN (${Prisma.join(ids)})`
    );
    for (const row of withAvatars) {
      const current = byId.get(row.establishment_id);
      if (current) current.avatar_url = row.avatar_url;
    }
  } catch {
    // Keep initials until client/DB agree on avatar_url.
  }

  const rows = grouped
    .map((g) => {
      const est = byId.get(g.establishment_id);
      if (!est) return null;
      return {
        id: est.establishment_id,
        name: est.name,
        points: g._sum.points ?? 0,
        avatar_url: est.avatar_url,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return toPodium(rows);
}

async function loadCatalog(
  role: "admin" | "user",
  userId: string
): Promise<EstablishmentRewardCatalogItem[]> {
  type CatalogRow = {
    establishment_reward_id: string;
    title: string;
    short_description: string;
    long_description: string | null;
    image_url: string | null;
    value_tonkis: number;
    value_usd: number;
    establishment_id: string;
    establishment_name: string;
  };

  const rows =
    role === "admin"
      ? await prisma.$queryRaw<CatalogRow[]>`
          SELECT
            er.establishment_reward_id,
            er.title,
            er.short_description,
            er.long_description,
            er.image_url,
            er.value_tonkis,
            er.value_usd,
            er.establishment_id,
            e.name AS establishment_name
          FROM Establishment_Reward er
          INNER JOIN Establishment e
            ON e.establishment_id = er.establishment_id
          WHERE er.admin_id = ${userId}
          ORDER BY er.value_tonkis ASC, er.title ASC
        `
      : await prisma.$queryRaw<CatalogRow[]>`
          SELECT
            er.establishment_reward_id,
            er.title,
            er.short_description,
            er.long_description,
            er.image_url,
            er.value_tonkis,
            er.value_usd,
            er.establishment_id,
            e.name AS establishment_name
          FROM Establishment_Reward er
          INNER JOIN Establishment e
            ON e.establishment_id = er.establishment_id
          ORDER BY er.value_tonkis ASC, er.title ASC
        `;

  return rows.map((row) => ({
    id: row.establishment_reward_id,
    title: row.title,
    short_description: row.short_description,
    long_description: row.long_description,
    image_url: row.image_url?.trim() || null,
    value_tonkis: Number(row.value_tonkis) || 0,
    value_usd: Number(row.value_usd) || 0,
    establishment_id: row.establishment_id,
    establishment_name: row.establishment_name,
  }));
}

export async function GET(req: Request) {
  try {
    const session = await verifySession(req);
    if (!session) {
      return apiError("No autenticado", 401);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: session.userId },
      select: {
        user_id: true,
        email: true,
        name: true,
        first_name: true,
        type: true,
        status: true,
      },
    });

    if (!user || user.status !== "active") {
      return apiError("No autenticado", 401);
    }

    const role = normalizeUserRole(user.type);
    if (!role) {
      return apiError("Cuenta con rol no válido", 403);
    }

    const pointsAgg = await prisma.reward.aggregate({
      where: { user_id: user.user_id },
      _sum: { points: true },
    });
    const total_points = pointsAgg._sum.points ?? 0;

    const payload: RewardsPagePayload = {
      role,
      greeting_name: greetingName(user),
      total_points,
      leaderboard: role === "admin" ? await loadAdminLeaderboard(user.user_id) : [],
      consumptions: role === "user" ? await loadUserConsumptions(user.user_id) : [],
      catalog: await loadCatalog(role, user.user_id),
    };

    return apiSuccess(payload);
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError("[api/rewards]", err);
    if (infra) return infra;
    return apiError("Error al cargar recompensas", 500);
  }
}
