import type { AirdropAssetCode } from "src/lib/airdrop/constants";
import type { AirdropConfigSnapshot } from "src/lib/airdrop/loadAirdropEligibleUsers";
import type { AirdropDistributionRow } from "src/lib/airdrop/eligibleUsers";
import type {
  AirdropHistoryConfigSnapshot,
  AirdropHistoryFees,
  AirdropHistoryRecipient,
} from "src/lib/airdrop/types";

export const AIRDROP_LOG_PAYLOAD_VERSION = 1 as const;

export type AirdropLogPayloadV1 = {
  version: typeof AIRDROP_LOG_PAYLOAD_VERSION;
  asset: AirdropAssetCode;
  config: AirdropHistoryConfigSnapshot;
  fees: AirdropHistoryFees;
  distributions: AirdropHistoryRecipient[];
  horizon: unknown | null;
};

export function buildAirdropLogPayload(input: {
  config: AirdropConfigSnapshot;
  distributions: AirdropDistributionRow[];
  fees: AirdropHistoryFees;
  asset: AirdropAssetCode;
  horizon: unknown | null;
}): string {
  const payload: AirdropLogPayloadV1 = {
    version: AIRDROP_LOG_PAYLOAD_VERSION,
    asset: input.asset,
    config: {
      amount: input.config.amount,
      asset: input.asset,
      scheduled_date: input.config.scheduled_date.toISOString(),
      scheduled_end_date: input.config.scheduled_end_date
        ? input.config.scheduled_end_date.toISOString()
        : null,
      periodicity_months: input.config.periodicity_months,
      max_users: input.config.max_users,
    },
    fees: input.fees,
    distributions: input.distributions.map((row) => ({
      user_id: row.user_id,
      name: row.name,
      wallet_address: row.wallet_address,
      tonkis: row.tonkis,
      fund_percent: row.fund_percent,
      amount: row.amount,
    })),
    horizon: input.horizon,
  };
  return JSON.stringify(payload);
}

export function parseAirdropLogPayload(
  raw: string | null | undefined
): AirdropLogPayloadV1 | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    if (o.version !== AIRDROP_LOG_PAYLOAD_VERSION) return null;
    if (!o.config || typeof o.config !== "object") return null;
    if (!Array.isArray(o.distributions)) return null;
    return parsed as AirdropLogPayloadV1;
  } catch {
    return null;
  }
}
