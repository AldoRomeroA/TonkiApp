export type AirdropUserRow = {
  user_id: string;
  name: string;
  wallet_address: string | null;
  tonkis: number;
  fund_percent: number;
};

export type AirdropPagePayload = {
  amount: number;
  source_public_key: string | null;
  scheduled_date: string | null;
  scheduled_end_date: string | null;
  max_users: number;
  periodicity_months: number;
  users: AirdropUserRow[];
};

export type AirdropConfigRecord = {
  amount: number;
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

type AirdropPageSuccessBody = AirdropPagePayload & { success: true };

export function isAirdropPageSuccess(data: unknown): data is AirdropPageSuccessBody {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  if (o.success !== true) return false;
  if (!Array.isArray(o.users)) return false;
  if (typeof o.amount !== "number") return false;
  return true;
}
