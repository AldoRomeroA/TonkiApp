export type SmartAccountPublicConfig = {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  accountWasmHash: string;
  webauthnVerifierAddress: string;
  nativeTokenContract: string;
  relayerUrl: string | null;
  rpId: string;
  rpName: string;
};

export type WalletCreateApiResponse = {
  wallet: {
    walletId: string;
    contractAddress: string;
    network: string;
    status: string;
    created: boolean;
  };
  redirectTo: string;
};

export type WalletStatusApiResponse = {
  hasWallet: boolean;
  wallet: {
    wallet_id: string;
    contract_address: string;
    network: string;
    status: string;
    created_at: string;
  } | null;
};
