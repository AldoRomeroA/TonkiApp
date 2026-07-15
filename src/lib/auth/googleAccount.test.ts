import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  authIdentity: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  user: {
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("src/lib/db", () => ({
  default: prismaMock,
}));

import { findOrCreateUserFromGoogle } from "src/lib/auth/googleAccount";
import type { GoogleProfile } from "src/lib/auth/googleOAuth";

const profile: GoogleProfile = {
  sub: "google-sub-abc",
  email: "tonki@example.com",
  emailVerified: true,
  name: "Tonki User",
  picture: "https://example.com/pic.png",
};

const existingUser = {
  user_id: "user-1",
  email: "tonki@example.com",
  name: "Tonki User",
  first_name: null,
  paternal_surname: null,
  maternal_surname: null,
  avatar_url: null,
  wallet_address: null,
  age: null,
  birth_date: null,
  type: "user",
  status: "active",
  created_at: new Date(),
  updated_at: new Date(),
};

describe("findOrCreateUserFromGoogle account linking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the existing user when Google identity is already linked", async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValue({
      identity_id: "identity-1",
      email: profile.email,
      email_verified: true,
      display_name: profile.name,
      avatar_url: profile.picture,
      user: existingUser,
    });

    const result = await findOrCreateUserFromGoogle(profile);

    expect(result).toEqual({ user: existingUser, isNew: false });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.authIdentity.create).not.toHaveBeenCalled();
  });

  it("creates a user and auth identity for a new Google account", async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValueOnce(null);
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        user: {
          create: vi.fn().mockResolvedValue(existingUser),
        },
        authIdentity: {
          create: vi.fn().mockResolvedValue({ identity_id: "identity-1" }),
        },
      })
    );

    const result = await findOrCreateUserFromGoogle(profile);

    expect(result).toEqual({ user: existingUser, isNew: true });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("handles duplicate identity races by returning the existing linked user", async () => {
    prismaMock.authIdentity.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        identity_id: "identity-1",
        user: existingUser,
      });
    prismaMock.$transaction.mockRejectedValue({ code: "P2002" });

    const result = await findOrCreateUserFromGoogle(profile);

    expect(result).toEqual({ user: existingUser, isNew: false });
    expect(prismaMock.authIdentity.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rethrows non-duplicate errors during account creation", async () => {
    prismaMock.authIdentity.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockRejectedValue(new Error("db unavailable"));

    await expect(findOrCreateUserFromGoogle(profile)).rejects.toThrow(
      "db unavailable"
    );
  });
});
