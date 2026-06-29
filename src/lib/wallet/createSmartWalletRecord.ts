import prisma from "src/lib/db";
import type { WalletCreateInput } from "src/lib/wallet/schemas";
import { getStellarNetwork } from "src/lib/wallet/smartAccountConfig";

export type SmartWalletRecordResult = {
  walletId: string;
  contractAddress: string;
  network: string;
  status: string;
  created: boolean;
};

export async function createSmartWalletRecord(
  userId: string,
  input: WalletCreateInput
): Promise<SmartWalletRecordResult> {
  const network = getStellarNetwork();

  const existingForUser = await prisma.smartWallet.findUnique({
    where: {
      user_id_network: {
        user_id: userId,
        network,
      },
    },
  });

  if (existingForUser) {
    if (existingForUser.contract_address === input.contractAddress) {
      return {
        walletId: existingForUser.wallet_id,
        contractAddress: existingForUser.contract_address,
        network: existingForUser.network,
        status: existingForUser.status,
        created: false,
      };
    }

    throw new Error("wallet_already_exists");
  }

  const existingContract = await prisma.smartWallet.findUnique({
    where: {
      network_contract_address: {
        network,
        contract_address: input.contractAddress,
      },
    },
    select: { user_id: true },
  });

  if (existingContract && existingContract.user_id !== userId) {
    throw new Error("contract_already_claimed");
  }

  const existingCredential = await prisma.passkeyCredential.findUnique({
    where: { credential_id: input.credentialId },
    select: { user_id: true },
  });

  if (existingCredential && existingCredential.user_id !== userId) {
    throw new Error("credential_already_claimed");
  }

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.smartWallet.create({
      data: {
        user_id: userId,
        network,
        contract_address: input.contractAddress,
        status: input.deploymentTxHash ? "active" : "pending",
      },
    });

    await tx.passkeyCredential.upsert({
      where: { credential_id: input.credentialId },
      create: {
        user_id: userId,
        wallet_id: wallet.wallet_id,
        credential_id: input.credentialId,
        public_key: input.publicKey,
        public_key_algorithm: input.publicKeyAlgorithm ?? -7,
        transports: input.transports ?? undefined,
        device_label: input.deviceLabel ?? null,
      },
      update: {
        wallet_id: wallet.wallet_id,
        public_key: input.publicKey,
        public_key_algorithm: input.publicKeyAlgorithm ?? -7,
        transports: input.transports ?? undefined,
        device_label: input.deviceLabel ?? undefined,
      },
    });

    if (input.deploymentTxHash) {
      await tx.smartWallet.update({
        where: { wallet_id: wallet.wallet_id },
        data: { status: "active" },
      });
    }

    return wallet;
  });

  return {
    walletId: result.wallet_id,
    contractAddress: result.contract_address,
    network: result.network,
    status: result.status,
    created: true,
  };
}
