import type { SmartAccountPublicConfig } from "src/types/wallet";

export function buildTonkiStorageName(config: SmartAccountPublicConfig): string {
  return `tonki-smart-account:${config.network}:${config.accountWasmHash.slice(0, 8)}`;
}

export function encodePublicKey(publicKey: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < publicKey.length; i += 1) {
    binary += String.fromCharCode(publicKey[i]!);
  }
  return btoa(binary);
}
