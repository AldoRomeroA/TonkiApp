import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jwtVerify = vi.fn();

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

import {
  generateOAuthSecrets,
  oauthStatesMatch,
  verifyGoogleIdToken,
} from "src/lib/auth/googleOAuth";

const oauthConfig = {
  clientId: "test-client-id.apps.googleusercontent.com",
  clientSecret: "test-secret",
  redirectUri: "http://localhost:3000/api/auth/google/callback",
};

describe("googleOAuth validation", () => {
  beforeEach(() => {
    jwtVerify.mockReset();
  });

  it("generates PKCE code_challenge as S256 of code_verifier", () => {
    const secrets = generateOAuthSecrets();
    const expected = createHash("sha256")
      .update(secrets.codeVerifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    expect(secrets.codeChallenge).toBe(expected);
    expect(secrets.nonce).toBeTruthy();
    expect(secrets.codeVerifier).toBeTruthy();
  });

  it("accepts matching OAuth state values", () => {
    const state = "abc123-state-value";
    expect(oauthStatesMatch(state, state)).toBe(true);
  });

  it("rejects OAuth state values with different lengths", () => {
    expect(oauthStatesMatch("short", "longer-state")).toBe(false);
  });

  it("rejects mismatched OAuth state values of equal length", () => {
    expect(oauthStatesMatch("state-aaaaaaaaaaaaaaaa", "state-bbbbbbbbbbbbbbbb")).toBe(
      false
    );
  });

  it("verifies a valid Google ID token and returns profile claims", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "google-sub-123",
        email: "user@example.com",
        email_verified: true,
        name: "Tonki User",
        picture: "https://example.com/avatar.png",
        nonce: "expected-nonce",
      },
    });

    const profile = await verifyGoogleIdToken(
      "fake.id.token",
      oauthConfig,
      "expected-nonce"
    );

    expect(profile).toEqual({
      sub: "google-sub-123",
      email: "user@example.com",
      emailVerified: true,
      name: "Tonki User",
      picture: "https://example.com/avatar.png",
    });
    expect(jwtVerify).toHaveBeenCalledOnce();
    expect(jwtVerify.mock.calls[0]?.[2]).toEqual({
      audience: oauthConfig.clientId,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
  });

  it("rejects ID tokens whose nonce does not match the OAuth cookie", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "google-sub-123",
        email: "user@example.com",
        email_verified: true,
        nonce: "wrong-nonce",
      },
    });

    await expect(
      verifyGoogleIdToken("fake.id.token", oauthConfig, "expected-nonce")
    ).rejects.toThrow("Google ID token nonce mismatch");
  });

  it("rejects ID tokens missing required subject or email claims", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        email: "user@example.com",
        email_verified: true,
        nonce: "expected-nonce",
      },
    });

    await expect(
      verifyGoogleIdToken("fake.id.token", oauthConfig, "expected-nonce")
    ).rejects.toThrow("Google ID token missing required claims");
  });

  it("rejects ID tokens with unverified email", async () => {
    jwtVerify.mockResolvedValue({
      payload: {
        sub: "google-sub-123",
        email: "user@example.com",
        email_verified: false,
        nonce: "expected-nonce",
      },
    });

    await expect(
      verifyGoogleIdToken("fake.id.token", oauthConfig, "expected-nonce")
    ).rejects.toThrow("Google email is not verified");
  });
});
