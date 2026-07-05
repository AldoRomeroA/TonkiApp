import prisma from "src/lib/db";
import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import {
  archiveEndedCampaigns,
  serializeCampaignArchive,
} from "src/lib/airdrop/campaignArchive";

export async function GET() {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    await archiveEndedCampaigns(gate.userId);

    const archives = await prisma.airdropCampaignArchive.findMany({
      where: { admin_id: gate.userId },
      orderBy: { campaign_end: "desc" },
    });

    return apiSuccess({
      archives: archives.map(serializeCampaignArchive),
    });
  } catch {
    return apiError("Error al cargar estadísticas", 500);
  }
}
