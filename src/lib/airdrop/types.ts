export type AirdropUserRow = {
  user_id: string;
  name: string;
  wallet_address: string | null;
  tonkis: number;
  fund_percent: number;
};

export type AirdropPagePayload = {
  amount: number;
  asset: "TONKI" | "XLM" | "USDC";
  source_public_key: string | null;
  scheduled_date: string | null;
  scheduled_end_date: string | null;
  max_users: number;
  periodicity_months: number;
  users: AirdropUserRow[];
};

export type AirdropConfigRecord = {
  amount: number;
  asset: "TONKI" | "XLM" | "USDC";
  scheduled_date: string;
  scheduled_end_date: string | null;
  periodicity_months: number;
  max_users: number;
};

export type AirdropCampaignArchiveRecord = {
  archive_id: string;
  campaign_start: string;
  campaign_end: string;
  balance_sent: number;
  users_sent: number;
  visitors_count: number;
  purchase_count: number;
  total_spent: number;
  archived_at: string;
};

export type AirdropStatsPayload = {
  archives: AirdropCampaignArchiveRecord[];
};

export type AirdropConfigPayload = {
  config: AirdropConfigRecord | null;
};

export type AirdropHistoryRecipient = {
  user_id: string;
  name: string;
  wallet_address: string | null;
  tonkis: number;
  fund_percent: number;
  amount: number;
};

export type AirdropHistoryConfigSnapshot = {
  amount: number;
  asset: "TONKI" | "XLM" | "USDC";
  scheduled_date: string;
  scheduled_end_date: string | null;
  periodicity_months: number;
  max_users: number;
};

export type AirdropHistoryFees = {
  user_pool: number;
  app_fee: number;
  stellar_reserve: number;
  app_fee_destination: string;
};

export type AirdropHistoryLogRecord = {
  log_id: string;
  executed_at: string;
  success: boolean;
  transaction_hash: string | null;
  total_amount: number;
  users_involved: number;
  error_message: string | null;
  asset: "TONKI" | "XLM" | "USDC" | null;
  config: AirdropHistoryConfigSnapshot;
  fees: AirdropHistoryFees | null;
  recipients: AirdropHistoryRecipient[];
};

export type AirdropHistoryPayload = {
  logs: AirdropHistoryLogRecord[];
};

type AirdropPageSuccessBody = AirdropPagePayload & { success: true };

export function isAirdropPageSuccess(data: unknown): data is AirdropPageSuccessBody {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  if (!Array.isArray(o.users)) return false;
  if (typeof o.amount !== "number") return false;
  return true;
}
