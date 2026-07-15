import {
  Asset,
  Horizon,
  Networks,
  Operation,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { randomUUID } from "crypto";

import prisma from "src/lib/db";
import {
  AIRDROP_APP_FEE_PUBLIC_KEY,
  AIRDROP_EMISOR_PUBLIC_KEY,
  getAirdropAssetDefinition,
  type AirdropAssetCode,
} from "src/lib/airdrop/constants";
import {
  computeAirdropDistributions,
  roundXlm,
} from "src/lib/airdrop/eligibleUsers";
import type { AirdropConfigSnapshot } from "src/lib/airdrop/loadAirdropEligibleUsers";
import { buildAirdropLogPayload } from "src/lib/airdrop/logPayload";
import type {
  AirdropHistoryFees,
  AirdropUserRow,
} from "src/lib/airdrop/types";

export type AirdropFeesPayload = AirdropHistoryFees;

function resolveStellarAsset(assetCode: AirdropAssetCode): Asset {
  const def = getAirdropAssetDefinition(assetCode);
  if (!def.issuer) return Asset.native();
  return new Asset(def.code, def.issuer);
}

export type PrepareAirdropResult =
  | {
      ok: true;
      unsigned_xdr: string;
      network_passphrase: string;
      source_public_key: string;
      total_amount: number;
      users_involved: number;
      fees: AirdropFeesPayload;
    }
  | { ok: false; error: string };

export type SubmitAirdropResult =
  | {
      ok: true;
      transaction_hash: string;
      horizon_url: string;
      source_public_key: string;
      total_amount: number;
      users_involved: number;
      fees: AirdropFeesPayload;
      log_id: string;
    }
  | { ok: false; error: string; log_id?: string };

export function getAirdropHorizonConfig(): {
  url: string;
  passphrase: string;
} {
  const network = (process.env.STELLAR_AIRDROP_NETWORK ?? "public")
    .trim()
    .toLowerCase();
  if (network === "testnet") {
    return {
      url:
        process.env.STELLAR_HORIZON_URL?.trim() ||
        "https://horizon-testnet.stellar.org",
      passphrase: Networks.TESTNET,
    };
  }
  return {
    url:
      process.env.STELLAR_HORIZON_URL?.trim() || "https://horizon.stellar.org",
    passphrase: Networks.PUBLIC,
  };
}

function truncateError(message: string, max = 255): string {
  if (message.length <= max) return message;
  return `${message.slice(0, max - 1)}…`;
}

/** Keep log payload small/serializable (omit bulky XDR blobs). */
function compactHorizonPayload(horizon: unknown): unknown {
  if (!horizon || typeof horizon !== "object") return horizon;
  const h = horizon as Record<string, unknown>;
  const extras =
    h.extras && typeof h.extras === "object"
      ? (h.extras as Record<string, unknown>)
      : null;
  return {
    hash: typeof h.hash === "string" ? h.hash : null,
    successful: typeof h.successful === "boolean" ? h.successful : null,
    ledger: typeof h.ledger === "number" ? h.ledger : null,
    title: typeof h.title === "string" ? h.title : null,
    status: typeof h.status === "number" ? h.status : null,
    detail: typeof h.detail === "string" ? h.detail : null,
    result_codes: extras?.result_codes ?? h.result_codes ?? null,
  };
}

function txHashHex(transaction: Transaction): string {
  return Buffer.from(transaction.hash()).toString("hex");
}

/** Prefer Horizon extras (result codes) over the generic title. */
export function formatHorizonError(err: unknown): {
  message: string;
  horizon: unknown | null;
} {
  const data =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { data?: unknown } }).response?.data
      : err && typeof err === "object" && "data" in err
        ? (err as { data?: unknown }).data
        : null;

  if (data && typeof data === "object") {
    const extras = (data as { extras?: Record<string, unknown> }).extras;
    const resultCodes = extras?.result_codes as
      | { transaction?: string; operations?: string[] }
      | undefined;
    const txCode = resultCodes?.transaction;
    const opCodes = resultCodes?.operations?.filter(Boolean).join(", ");
    const detail =
      typeof (data as { detail?: unknown }).detail === "string"
        ? (data as { detail: string }).detail
        : null;
    const title =
      typeof (data as { title?: unknown }).title === "string"
        ? (data as { title: string }).title
        : null;

    const hasNoTrust = resultCodes?.operations?.includes("op_no_trust");
    const noTrustHint = hasNoTrust
      ? "Una o más wallets destino no tienen trustline del activo (TONKI/USDC). Deben agregar el activo en Freighter antes de recibir."
      : null;

    const parts = [
      title,
      txCode ? `tx: ${txCode}` : null,
      opCodes ? `ops: ${opCodes}` : null,
      noTrustHint,
      detail,
    ].filter(Boolean);

    return {
      message: parts.join(" — ") || "Transacción rechazada por Horizon",
      horizon: data,
    };
  }

  const message =
    err instanceof Error ? err.message : "Error al enviar la transacción";
  return { message, horizon: null };
}

export async function writeAirdropLog(input: {
  configId: string;
  transactionHash: string | null;
  totalAmount: number;
  usersInvolved: number;
  success: boolean;
  errorMessage: string | null;
  responseJson: string | null;
}): Promise<string> {
  const log = await prisma.airdropLog.create({
    data: {
      log_id: randomUUID(),
      config_id: input.configId,
      transaction_hash: input.transactionHash,
      total_amount: input.totalAmount,
      users_involved: input.usersInvolved,
      success: input.success,
      error_message: input.errorMessage
        ? truncateError(input.errorMessage)
        : null,
      response_json: input.responseJson,
    },
    select: { log_id: true },
  });
  return log.log_id;
}

function validateUsersForSend(users: AirdropUserRow[]): string | null {
  if (users.length === 0) {
    return "No hay usuarios elegibles para el airdrop";
  }
  if (users.some((u) => !u.wallet_address?.trim())) {
    return "Hay usuarios elegibles sin wallet. Completa sus wallets antes de enviar.";
  }
  return null;
}

function shortWallet(wallet: string): string {
  if (wallet.length <= 16) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

/** Issuer accounts can hold their own asset without a trustline. */
function accountCanReceiveAsset(
  account: Horizon.AccountResponse,
  asset: Asset
): boolean {
  if (asset.isNative()) return true;
  if (account.account_id === asset.getIssuer()) return true;
  return account.balances.some((balance) => {
    if (balance.asset_type === "native") return false;
    if (!("asset_code" in balance) || !("asset_issuer" in balance)) return false;
    return (
      balance.asset_code === asset.getCode() &&
      balance.asset_issuer === asset.getIssuer()
    );
  });
}

async function findMissingAssetTrustlines(params: {
  server: Horizon.Server;
  asset: Asset;
  destinations: Array<{ label: string; wallet: string }>;
}): Promise<string[]> {
  if (params.asset.isNative()) return [];

  const missing: string[] = [];
  for (const dest of params.destinations) {
    try {
      const account = await params.server.loadAccount(dest.wallet);
      if (!accountCanReceiveAsset(account, params.asset)) {
        missing.push(`${dest.label} (${shortWallet(dest.wallet)})`);
      }
    } catch {
      missing.push(
        `${dest.label} (${shortWallet(dest.wallet)}) — cuenta no encontrada`
      );
    }
  }
  return missing;
}

/**
 * Builds an unsigned payment transaction for Freighter to sign.
 * Source account must be the configured emitter wallet.
 */
export async function prepareAirdropTransaction(params: {
  sourcePublicKey: string;
  config: AirdropConfigSnapshot;
  users: AirdropUserRow[];
  asset: AirdropAssetCode;
}): Promise<PrepareAirdropResult> {
  const sourcePublicKey = params.sourcePublicKey.trim();
  if (sourcePublicKey !== AIRDROP_EMISOR_PUBLIC_KEY) {
    return {
      ok: false,
      error:
        "Freighter debe usar la wallet emisora del airdrop. Cambia de cuenta en Freighter.",
    };
  }

  const userError = validateUsersForSend(params.users);
  if (userError) return { ok: false, error: userError };

  const { distributions, fees, totalToUsers } = computeAirdropDistributions(
    params.users,
    params.config.amount
  );

  if (distributions.length === 0) {
    return {
      ok: false,
      error: "No hay usuarios con wallet para recibir el airdrop",
    };
  }

  try {
    const { url: horizonUrl, passphrase } = getAirdropHorizonConfig();
    const server = new Horizon.Server(horizonUrl);
    const sourceAccount = await server.loadAccount(sourcePublicKey);
    const stellarAsset = resolveStellarAsset(params.asset);

    const destinations: Array<{ label: string; wallet: string }> = [];
    for (const row of distributions) {
      if (row.amount <= 0 || !row.wallet_address) continue;
      destinations.push({
        label: row.name?.trim() || "Usuario",
        wallet: row.wallet_address.trim(),
      });
    }
    if (
      fees.app_fee > 0 &&
      AIRDROP_APP_FEE_PUBLIC_KEY !== sourcePublicKey
    ) {
      destinations.push({
        label: "Wallet de fee de la app",
        wallet: AIRDROP_APP_FEE_PUBLIC_KEY,
      });
    }

    const missingTrust = await findMissingAssetTrustlines({
      server,
      asset: stellarAsset,
      destinations,
    });
    if (missingTrust.length > 0) {
      const assetCode = params.asset;
      return {
        ok: false,
        error: `No se puede enviar ${assetCode}: estas wallets no tienen trustline del activo (deben agregarlo en Freighter antes de recibir): ${missingTrust.join("; ")}`,
      };
    }

    const opCount =
      distributions.filter((d) => d.amount > 0).length +
      (fees.app_fee > 0 && AIRDROP_APP_FEE_PUBLIC_KEY !== sourcePublicKey
        ? 1
        : 0);

    const builder = new TransactionBuilder(sourceAccount, {
      fee: String(Math.max(100 * Math.max(opCount, 1), 100)),
      networkPassphrase: passphrase,
    });

    for (const row of distributions) {
      if (row.amount <= 0) continue;
      builder.addOperation(
        Operation.payment({
          destination: row.wallet_address!,
          asset: stellarAsset,
          amount: row.amount.toFixed(7),
        })
      );
    }

    if (
      fees.app_fee > 0 &&
      AIRDROP_APP_FEE_PUBLIC_KEY !== sourcePublicKey
    ) {
      builder.addOperation(
        Operation.payment({
          destination: AIRDROP_APP_FEE_PUBLIC_KEY,
          asset: stellarAsset,
          amount: fees.app_fee.toFixed(7),
        })
      );
    }

    const transaction = builder.setTimeout(180).build();

    return {
      ok: true,
      unsigned_xdr: transaction.toXDR(),
      network_passphrase: passphrase,
      source_public_key: sourcePublicKey,
      total_amount: roundXlm(totalToUsers),
      users_involved: distributions.length,
      fees: {
        user_pool: fees.user_pool,
        app_fee: fees.app_fee,
        stellar_reserve: fees.stellar_reserve,
        app_fee_destination: AIRDROP_APP_FEE_PUBLIC_KEY,
      },
    };
  } catch (err) {
    const { message } = formatHorizonError(err);
    return {
      ok: false,
      error: message || "No se pudo preparar la transacción",
    };
  }
}

/**
 * Submits a Freighter-signed transaction and writes AirdropLog.
 */
export async function submitSignedAirdropTransaction(params: {
  signedXdr: string;
  config: AirdropConfigSnapshot;
  users: AirdropUserRow[];
  asset: AirdropAssetCode;
  expectedSourcePublicKey?: string;
}): Promise<SubmitAirdropResult> {
  const { config, users, asset } = params;
  const { distributions, fees, totalToUsers } = computeAirdropDistributions(
    users,
    config.amount
  );

  const feesPayload: AirdropFeesPayload = {
    user_pool: fees.user_pool,
    app_fee: fees.app_fee,
    stellar_reserve: fees.stellar_reserve,
    app_fee_destination: AIRDROP_APP_FEE_PUBLIC_KEY,
  };

  const snapshotJson = (horizon: unknown | null) =>
    buildAirdropLogPayload({
      config,
      distributions,
      fees: feesPayload,
      asset,
      horizon: compactHorizonPayload(horizon),
    });

  const { url: horizonUrl, passphrase } = getAirdropHorizonConfig();

  try {
    const transaction = new Transaction(params.signedXdr.trim(), passphrase);
    const sourcePublicKey = transaction.source;
    const expectedHash = txHashHex(transaction);

    if (sourcePublicKey !== AIRDROP_EMISOR_PUBLIC_KEY) {
      const logId = await writeAirdropLog({
        configId: config.config_id,
        transactionHash: null,
        totalAmount: 0,
        usersInvolved: 0,
        success: false,
        errorMessage: "La transacción firmada no usa la wallet emisora",
        responseJson: snapshotJson(null),
      });
      return {
        ok: false,
        error: "La transacción firmada no usa la wallet emisora del airdrop",
        log_id: logId,
      };
    }

    if (
      params.expectedSourcePublicKey &&
      params.expectedSourcePublicKey !== sourcePublicKey
    ) {
      const logId = await writeAirdropLog({
        configId: config.config_id,
        transactionHash: null,
        totalAmount: 0,
        usersInvolved: 0,
        success: false,
        errorMessage: "La cuenta de Freighter no coincide con la preparación",
        responseJson: snapshotJson(null),
      });
      return {
        ok: false,
        error: "La cuenta de Freighter no coincide con la preparación",
        log_id: logId,
      };
    }

    if (!transaction.signatures.length) {
      const logId = await writeAirdropLog({
        configId: config.config_id,
        transactionHash: null,
        totalAmount: totalToUsers,
        usersInvolved: distributions.length,
        success: false,
        errorMessage: "La transacción no tiene firma",
        responseJson: snapshotJson(null),
      });
      return {
        ok: false,
        error: "Freighter no devolvió una firma válida",
        log_id: logId,
      };
    }

    const server = new Horizon.Server(horizonUrl);
    let response: Horizon.HorizonApi.SubmitTransactionResponse;
    try {
      response = await server.submitTransaction(transaction);
    } catch (err) {
      const { message, horizon } = formatHorizonError(err);

      // Tx may already be included even if the HTTP submit errored/timed out.
      try {
        const existing = await server
          .transactions()
          .transaction(expectedHash)
          .call();
        if (existing.successful) {
          response = existing as Horizon.HorizonApi.SubmitTransactionResponse;
        } else {
          throw err;
        }
      } catch {
        const logId = await writeAirdropLog({
          configId: config.config_id,
          transactionHash: null,
          totalAmount: totalToUsers,
          usersInvolved: distributions.length,
          success: false,
          errorMessage: message,
          responseJson: snapshotJson(horizon),
        });
        return { ok: false, error: message, log_id: logId };
      }
    }

    const txHash = response.hash ?? expectedHash;

    let logId: string;
    try {
      logId = await writeAirdropLog({
        configId: config.config_id,
        transactionHash: txHash,
        totalAmount: roundXlm(totalToUsers),
        usersInvolved: distributions.length,
        success: true,
        errorMessage: null,
        responseJson: snapshotJson(response),
      });
    } catch {
      // Chain already succeeded — do not report failure to the admin UI.
      logId = expectedHash;
    }

    return {
      ok: true,
      transaction_hash: txHash,
      horizon_url: `${horizonUrl.replace(/\/$/, "")}/transactions/${txHash}`,
      source_public_key: sourcePublicKey,
      total_amount: roundXlm(totalToUsers),
      users_involved: distributions.length,
      fees: feesPayload,
      log_id: logId,
    };
  } catch (err) {
    const { message, horizon } = formatHorizonError(err);
    try {
      const logId = await writeAirdropLog({
        configId: config.config_id,
        transactionHash: null,
        totalAmount: roundXlm(totalToUsers),
        usersInvolved: distributions.length,
        success: false,
        errorMessage: message,
        responseJson: snapshotJson(horizon),
      });
      return { ok: false, error: message, log_id: logId };
    } catch {
      return { ok: false, error: message };
    }
  }
}
