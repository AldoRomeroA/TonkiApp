import { apiError, apiSuccess } from "src/lib/api/response";
import { requireActiveAdminSession } from "src/lib/api/requireActiveAdmin";
import { normalizeAirdropAssetCode } from "src/lib/airdrop/constants";
import { parseAirdropLogPayload } from "src/lib/airdrop/logPayload";
import prisma from "src/lib/db";
import type { AirdropHistoryLogRecord } from "src/lib/airdrop/types";

export async function GET() {
  try {
    const gate = await requireActiveAdminSession();
    if (!gate.ok) return gate.response;

    const rows = await prisma.airdropLog.findMany({
      where: { config: { user_id: gate.userId } },
      orderBy: { executed_at: "desc" },
      take: 100,
      include: {
        config: {
          select: {
            amount: true,
            asset: true,
            scheduled_date: true,
            scheduled_end_date: true,
            periodicity_months: true,
            max_users: true,
          },
        },
      },
    });

    const logs: AirdropHistoryLogRecord[] = rows.map((row) => {
      const payload = parseAirdropLogPayload(row.response_json);
      const configAsset = normalizeAirdropAssetCode(row.config.asset);
      const resolvedAsset =
        payload?.asset === "TONKI" ||
        payload?.asset === "XLM" ||
        payload?.asset === "USDC"
          ? payload.asset
          : configAsset;

      const configFromRelation = {
        amount: row.config.amount,
        asset: configAsset,
        scheduled_date: row.config.scheduled_date.toISOString(),
        scheduled_end_date: row.config.scheduled_end_date
          ? row.config.scheduled_end_date.toISOString()
          : null,
        periodicity_months: row.config.periodicity_months,
        max_users: row.config.max_users,
      };

      const payloadConfig = payload?.config;
      const config = payloadConfig
        ? {
            amount: payloadConfig.amount,
            asset: normalizeAirdropAssetCode(
              (payloadConfig as { asset?: unknown }).asset ?? resolvedAsset
            ),
            scheduled_date: payloadConfig.scheduled_date,
            scheduled_end_date: payloadConfig.scheduled_end_date,
            periodicity_months: payloadConfig.periodicity_months,
            max_users: payloadConfig.max_users,
          }
        : configFromRelation;

      return {
        log_id: row.log_id,
        executed_at: row.executed_at.toISOString(),
        success: row.success,
        transaction_hash: row.transaction_hash,
        total_amount: row.total_amount,
        users_involved: row.users_involved,
        error_message: row.error_message,
        asset: resolvedAsset,
        config,
        fees: payload?.fees ?? null,
        recipients: payload?.distributions ?? [],
      };
    });

    return apiSuccess({ logs });
  } catch {
    return apiError("Error al cargar el historial de airdrop", 500);
  }
}
