import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";

const mockCookieGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockCookieGet })),
}));

vi.mock("src/lib/auth/security", () => ({
  applyAuthFailureDelay: vi.fn().mockResolvedValue(undefined),
  AUTH_FAILURE_DELAY_MS: 0,
}));

vi.mock("src/lib/db", () => ({
  default: {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    credential: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import prisma from "src/lib/db";
import { POST as walletLogin } from "app/api/auth/wallet-login/route";
import {
  WALLET_NONCE_COOKIE,
  buildWalletChallengeMessage,
  clearWalletNonceCookie,
  generateWalletNonce,
} from "src/lib/auth/walletChallenge";

const SIGN_MESSAGE_PREFIX = "Stellar Signed Message:\n";

function signWalletChallenge(publicKey: string, secretKey: string, nonce: string) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const message = buildWalletChallengeMessage(nonce);
  const messageHash = createHash("sha256")
    .update(SIGN_MESSAGE_PREFIX + message)
    .digest();
  return {
    publicKey,
    signature: keypair.sign(messageHash).toString("base64"),
  };
}

describe("wallet challenge replay prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "x".repeat(32);
  });

  it("generates a 32-character hex nonce", () => {
    const nonce = generateWalletNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("clears the nonce cookie after use", () => {
    const res = NextResponse.json({});
    clearWalletNonceCookie(res);
    const cleared = res.cookies.get(WALLET_NONCE_COOKIE);

    expect(cleared?.value).toBe("");
    expect(cleared?.maxAge).toBe(0);
  });

  it("rejects wallet login when the challenge cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const keypair = StellarSdk.Keypair.random();
    const nonce = generateWalletNonce();
    const signed = signWalletChallenge(
      keypair.publicKey(),
      keypair.secret(),
      nonce
    );

    const res = await walletLogin(
      new Request("http://localhost/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signed),
      })
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("solicita un nuevo reto");
    const cleared = res.cookies.get(WALLET_NONCE_COOKIE);
    expect(cleared?.maxAge).toBe(0);
  });

  it("rejects wallet login when the challenge cookie has an invalid format", async () => {
    mockCookieGet.mockReturnValue({ value: "not-a-valid-nonce" });

    const keypair = StellarSdk.Keypair.random();
    const nonce = generateWalletNonce();
    const signed = signWalletChallenge(
      keypair.publicKey(),
      keypair.secret(),
      nonce
    );

    const res = await walletLogin(
      new Request("http://localhost/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signed),
      })
    );

    expect(res.status).toBe(401);
    const cleared = res.cookies.get(WALLET_NONCE_COOKIE);
    expect(cleared?.maxAge).toBe(0);
  });

  it("clears the nonce cookie after a successful login to block replay", async () => {
    const keypair = StellarSdk.Keypair.random();
    const nonce = generateWalletNonce();
    const signed = signWalletChallenge(
      keypair.publicKey(),
      keypair.secret(),
      nonce
    );

    mockCookieGet.mockReturnValue({ value: nonce });
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      user_id: "user-1",
      email: null,
      name: "Wallet user",
      first_name: null,
      paternal_surname: null,
      maternal_surname: null,
      avatar_url: null,
      wallet_address: keypair.publicKey(),
      age: null,
      birth_date: null,
      type: "user",
      status: "active",
      created_at: new Date(),
      updated_at: new Date(),
    });

    const res = await walletLogin(
      new Request("http://localhost/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signed),
      })
    );

    expect(res.status).toBe(200);
    const cleared = res.cookies.get(WALLET_NONCE_COOKIE);
    expect(cleared?.maxAge).toBe(0);
  });

  it("returns needsRegistration and pending cookie when wallet is unknown", async () => {
    const keypair = StellarSdk.Keypair.random();
    const nonce = generateWalletNonce();
    const signed = signWalletChallenge(
      keypair.publicKey(),
      keypair.secret(),
      nonce
    );

    mockCookieGet.mockReturnValue({ value: nonce });
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

    const res = await walletLogin(
      new Request("http://localhost/api/auth/wallet-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signed),
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.needsRegistration).toBe(true);
    expect(body.publicKey).toBe(keypair.publicKey());
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(res.cookies.get(WALLET_NONCE_COOKIE)?.maxAge).toBe(0);
    expect(res.cookies.get("tonki_wallet_pending")?.value).toBeTruthy();
  });
});
