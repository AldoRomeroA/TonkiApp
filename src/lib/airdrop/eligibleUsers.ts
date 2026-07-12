import {
  AIRDROP_APP_FEE_RATIO,
  AIRDROP_STELLAR_RESERVE_RATIO,
  AIRDROP_USER_POOL_RATIO,
} from "src/lib/airdrop/constants";
import type { AirdropUserRow } from "src/lib/airdrop/types";

export type AirdropEligibleInput = {
  user_id: string;
  name: string;
  wallet_address: string | null;
  tonkis: number;
};

export type AirdropDistributionRow = AirdropUserRow & {
  amount: number;
};

export type AirdropFeeBreakdown = {
  user_pool: number;
  app_fee: number;
  stellar_reserve: number;
};

/** Stellar amounts use up to 7 decimal places. */
export function roundXlm(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

/**
 * Assigns each listed user a share of the **98% user pool**, proportional to tonkis
 * among that same list (not the global reward total).
 * Display `fund_percent` is relative to the full configured amount (sums ≈ 98).
 */
export function applyAirdropSharePercents(
  users: AirdropEligibleInput[]
): AirdropUserRow[] {
  const sumTonkis = users.reduce((sum, row) => sum + row.tonkis, 0);

  return users.map((row) => {
    const shareOfPool = sumTonkis > 0 ? row.tonkis / sumTonkis : 0;
    return {
      user_id: row.user_id,
      name: row.name,
      wallet_address: row.wallet_address,
      tonkis: row.tonkis,
      fund_percent: roundXlm(shareOfPool * AIRDROP_USER_POOL_RATIO * 100),
    };
  });
}

export function computeAirdropDistributions(
  users: AirdropUserRow[],
  fondoTotal: number
): {
  distributions: AirdropDistributionRow[];
  fees: AirdropFeeBreakdown;
  totalToUsers: number;
} {
  const fees: AirdropFeeBreakdown = {
    user_pool: roundXlm(fondoTotal * AIRDROP_USER_POOL_RATIO),
    app_fee: roundXlm(fondoTotal * AIRDROP_APP_FEE_RATIO),
    stellar_reserve: roundXlm(fondoTotal * AIRDROP_STELLAR_RESERVE_RATIO),
  };

  const payable = users.filter((u) => Boolean(u.wallet_address?.trim()));
  const sumTonkis = payable.reduce((sum, row) => sum + row.tonkis, 0);

  const distributions: AirdropDistributionRow[] = payable.map((row) => {
    const shareOfPool = sumTonkis > 0 ? row.tonkis / sumTonkis : 0;
    return {
      ...row,
      wallet_address: row.wallet_address!.trim(),
      fund_percent: roundXlm(shareOfPool * AIRDROP_USER_POOL_RATIO * 100),
      amount: roundXlm(shareOfPool * fees.user_pool),
    };
  });

  // Absorb rounding dust into the largest payment so the pool is fully allocated.
  const paid = roundXlm(
    distributions.reduce((sum, row) => sum + row.amount, 0)
  );
  const dust = roundXlm(fees.user_pool - paid);
  if (distributions.length > 0 && dust !== 0) {
    const top = distributions.reduce((best, row) =>
      row.amount >= best.amount ? row : best
    );
    top.amount = roundXlm(top.amount + dust);
  }

  return {
    distributions,
    fees,
    totalToUsers: roundXlm(
      distributions.reduce((sum, row) => sum + row.amount, 0)
    ),
  };
}
