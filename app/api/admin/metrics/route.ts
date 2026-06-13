import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";

export async function GET() {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;
    const userId = gate.userId;

    const [aggregate, topByViews, topByShares] = await Promise.all([
      prisma.post.aggregate({
        where: { author_id: userId },
        _sum: { view_count: true, share_count: true },
        _count: { post_id: true },
        _avg: { view_count: true, share_count: true },
      }),
      prisma.post.findMany({
        where: { author_id: userId },
        orderBy: [{ view_count: "desc" }, { created_at: "desc" }],
        take: 10,
        select: {
          post_id: true,
          title: true,
          view_count: true,
          share_count: true,
          created_at: true,
        },
      }),
      prisma.post.findMany({
        where: { author_id: userId },
        orderBy: [{ share_count: "desc" }, { created_at: "desc" }],
        take: 10,
        select: {
          post_id: true,
          title: true,
          view_count: true,
          share_count: true,
          created_at: true,
        },
      }),
    ]);

    const postCount = aggregate._count.post_id;
    const totalViews = aggregate._sum.view_count ?? 0;
    const totalShares = aggregate._sum.share_count ?? 0;

    return apiSuccess({
      totals: {
        post_count: postCount,
        total_views: totalViews,
        total_shares: totalShares,
        avg_views: aggregate._avg.view_count ?? 0,
        avg_shares: aggregate._avg.share_count ?? 0,
      },
      top_by_views: topByViews.map((p) => ({
        post_id: p.post_id,
        title: p.title,
        view_count: p.view_count,
        share_count: p.share_count,
        created_at: p.created_at.toISOString(),
      })),
      top_by_shares: topByShares.map((p) => ({
        post_id: p.post_id,
        title: p.title,
        view_count: p.view_count,
        share_count: p.share_count,
        created_at: p.created_at.toISOString(),
      })),
    });
  } catch {
    return apiError("Error al cargar métricas", 500);
  }
}
