import { describe, expect, it } from "vitest";

import {
  applyAirdropSharePercents,
  computeAirdropDistributions,
  roundXlm,
} from "src/lib/airdrop/eligibleUsers";

describe("airdrop share math", () => {
  it("gives a single user 98% of the fund", () => {
    const rows = applyAirdropSharePercents([
      {
        user_id: "1",
        name: "Solo",
        wallet_address: "GABC",
        tonkis: 10,
      },
    ]);
    expect(rows[0]?.fund_percent).toBe(98);

    const { distributions, fees, totalToUsers } = computeAirdropDistributions(
      rows,
      100
    );
    expect(fees.user_pool).toBe(98);
    expect(fees.app_fee).toBe(1);
    expect(fees.stellar_reserve).toBe(1);
    expect(distributions).toHaveLength(1);
    expect(distributions[0]?.amount).toBe(98);
    expect(totalToUsers).toBe(98);
  });

  it("splits the 98% pool by tonkis among multiple users", () => {
    const rows = applyAirdropSharePercents([
      {
        user_id: "1",
        name: "A",
        wallet_address: "GA",
        tonkis: 75,
      },
      {
        user_id: "2",
        name: "B",
        wallet_address: "GB",
        tonkis: 25,
      },
    ]);

    expect(rows[0]?.fund_percent).toBe(73.5);
    expect(rows[1]?.fund_percent).toBe(24.5);

    const { distributions, totalToUsers } = computeAirdropDistributions(
      rows,
      100
    );
    expect(distributions[0]?.amount).toBe(73.5);
    expect(distributions[1]?.amount).toBe(24.5);
    expect(roundXlm(totalToUsers)).toBe(98);
  });
});
