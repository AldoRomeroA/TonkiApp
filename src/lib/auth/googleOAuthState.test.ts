import { afterEach, describe, expect, it } from "vitest";

import {
  createSignedGoogleOAuthState,
  verifySignedGoogleOAuthState,
} from "src/lib/auth/googleOAuthState";

const ORIGINAL_SECRET = process.env.AUTH_SECRET;

describe("googleOAuthState", () => {
  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = ORIGINAL_SECRET;
  });

  it("round-trips nonce, codeVerifier and returnTo", async () => {
    process.env.AUTH_SECRET = "tonki-test-auth-secret-at-least-32-chars!!";

    const state = await createSignedGoogleOAuthState({
      nonce: "nonce-value-aaaa",
      codeVerifier: "verifier-value-bbbb",
      returnTo: "/dashboard",
    });

    const parsed = await verifySignedGoogleOAuthState(state);
    expect(parsed).toEqual({
      nonce: "nonce-value-aaaa",
      codeVerifier: "verifier-value-bbbb",
      returnTo: "/dashboard",
    });
  });

  it("rejects tampered state", async () => {
    process.env.AUTH_SECRET = "tonki-test-auth-secret-at-least-32-chars!!";

    const state = await createSignedGoogleOAuthState({
      nonce: "nonce-value-aaaa",
      codeVerifier: "verifier-value-bbbb",
      returnTo: null,
    });

    const tampered = `${state.slice(0, -4)}xxxx`;
    expect(await verifySignedGoogleOAuthState(tampered)).toBeNull();
  });

  it("rejects state signed with a different secret", async () => {
    process.env.AUTH_SECRET = "tonki-test-auth-secret-at-least-32-chars!!";
    const state = await createSignedGoogleOAuthState({
      nonce: "nonce-value-aaaa",
      codeVerifier: "verifier-value-bbbb",
      returnTo: null,
    });

    process.env.AUTH_SECRET = "different-auth-secret-at-least-32-chars!";
    expect(await verifySignedGoogleOAuthState(state)).toBeNull();
  });
});
