/** Stellar Smart Account Kit defaults (OpenZeppelin testnet contracts). */
export const STELLAR_TESTNET_DEFAULTS = {
  network: "testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  accountWasmHash:
    "8537b8166c0078440a5324c12f6db48d6340d157c306a54c5ea81405abcc2611",
  webauthnVerifierAddress:
    "CCMR63YE5T7MPWREF3PC5XNTTGXFSB4GYUGUIT5POHP2UGCS65TBIUUU",
  nativeTokenContract:
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
} as const;

function readEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value || fallback;
}

export function getStellarNetwork(): string {
  return readEnv("STELLAR_NETWORK", STELLAR_TESTNET_DEFAULTS.network);
}

export function getSmartAccountServerConfig() {
  const network = getStellarNetwork();
  return {
    network,
    rpcUrl: readEnv("STELLAR_RPC_URL", STELLAR_TESTNET_DEFAULTS.rpcUrl),
    networkPassphrase: readEnv(
      "STELLAR_NETWORK_PASSPHRASE",
      STELLAR_TESTNET_DEFAULTS.networkPassphrase
    ),
    accountWasmHash: readEnv(
      "STELLAR_ACCOUNT_WASM_HASH",
      STELLAR_TESTNET_DEFAULTS.accountWasmHash
    ),
    webauthnVerifierAddress: readEnv(
      "STELLAR_WEBAUTHN_VERIFIER_ADDRESS",
      STELLAR_TESTNET_DEFAULTS.webauthnVerifierAddress
    ),
    nativeTokenContract: readEnv(
      "STELLAR_NATIVE_TOKEN_CONTRACT",
      STELLAR_TESTNET_DEFAULTS.nativeTokenContract
    ),
    relayerUrl: process.env.STELLAR_RELAYER_URL?.trim() || null,
    rpName: readEnv("WEBAUTHN_RP_NAME", "Tonki"),
  };
}

export function isSmartWalletConfigured(): boolean {
  const cfg = getSmartAccountServerConfig();
  return Boolean(
    cfg.rpcUrl &&
      cfg.networkPassphrase &&
      cfg.accountWasmHash &&
      cfg.webauthnVerifierAddress
  );
}

/** Public config exposed to the browser for Smart Account Kit initialization. */
export function getSmartAccountPublicConfig(origin: string | null) {
  const cfg = getSmartAccountServerConfig();
  const rpId =
    process.env.WEBAUTHN_RP_ID?.trim() ||
    (origin ? new URL(origin).hostname : "localhost");

  return {
    network: cfg.network,
    rpcUrl: cfg.rpcUrl,
    networkPassphrase: cfg.networkPassphrase,
    accountWasmHash: cfg.accountWasmHash,
    webauthnVerifierAddress: cfg.webauthnVerifierAddress,
    nativeTokenContract: cfg.nativeTokenContract,
    relayerUrl: cfg.relayerUrl,
    rpId,
    rpName: cfg.rpName,
  };
}
