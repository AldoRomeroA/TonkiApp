import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  smartWallet: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passkeyCredential: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("src/lib/db", () => ({
  default: prismaMock,
}));

vi.mock("src/lib/wallet/smartAccountConfig", () => ({
  getStellarNetwork: () => "testnet",
}));

import { createSmartWalletRecord } from "src/lib/wallet/createSmartWalletRecord";

const userId = "user-11111111-1111-1111-1111-111111111111";
const contractAddress = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const credentialId = "cred-abc";
const publicKey = Buffer.from([0x04, ...Array(64).fill(1)]).toString("base64");

const walletInput = {
  contractAddress,
  credentialId,
  publicKey,
  publicKeyAlgorithm: -7,
};

const existingWallet = {
  wallet_id: "wallet-1",
  user_id: userId,
  network: "testnet",
  contract_address: contractAddress,
  status: "active",
  created_at: new Date(),
  updated_at: new Date(),
};

describe("createSmartWalletRecord idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.passkeyCredential.findUnique.mockResolvedValue(null);
  });

  it("returns the existing wallet without creating a duplicate", async () => {
    prismaMock.smartWallet.findUnique.mockResolvedValueOnce(existingWallet);

    const result = await createSmartWalletRecord(userId, walletInput);

    expect(result).toEqual({
      walletId: existingWallet.wallet_id,
      contractAddress,
      network: "testnet",
      status: "active",
      created: false,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a second wallet for the same user on the same network", async () => {
    prismaMock.smartWallet.findUnique.mockResolvedValueOnce({
      ...existingWallet,
      contract_address: "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBSC4",
    });

    await expect(createSmartWalletRecord(userId, walletInput)).rejects.toThrow(
      "wallet_already_exists"
    );
  });

  it("rejects contract addresses already claimed by another user", async () => {
    prismaMock.smartWallet.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ user_id: "other-user" });

    await expect(createSmartWalletRecord(userId, walletInput)).rejects.toThrow(
      "contract_already_claimed"
    );
  });

  it("rejects passkey credentials already claimed by another user", async () => {
    prismaMock.smartWallet.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.passkeyCredential.findUnique.mockResolvedValue({
      user_id: "other-user",
    });

    await expect(createSmartWalletRecord(userId, walletInput)).rejects.toThrow(
      "credential_already_claimed"
    );
  });

  it("creates wallet and passkey records on first submission", async () => {
    prismaMock.smartWallet.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        smartWallet: {
          create: vi.fn().mockResolvedValue({
            ...existingWallet,
            status: "pending",
          }),
          update: vi.fn(),
        },
        passkeyCredential: {
          upsert: vi.fn(),
        },
      })
    );

    const result = await createSmartWalletRecord(userId, walletInput);

    expect(result.created).toBe(true);
    expect(result.walletId).toBe("wallet-1");
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });
});
