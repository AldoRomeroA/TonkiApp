import prisma from "src/lib/db";
import { GOOGLE_PROVIDER } from "src/lib/auth/googleOAuthConfig";
import type { GoogleProfile } from "src/lib/auth/googleOAuth";
import type { User } from "src/generated/prisma/client";

function defaultDisplayName(profile: GoogleProfile): string {
  if (profile.name?.trim()) return profile.name.trim();
  const local = profile.email.split("@")[0]?.trim();
  return local || "Tonki user";
}

export async function findOrCreateUserFromGoogle(
  profile: GoogleProfile
): Promise<{ user: User; isNew: boolean }> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_provider_subject: {
        provider: GOOGLE_PROVIDER,
        provider_subject: profile.sub,
      },
    },
    include: { user: true },
  });

  if (existing) {
    const updates: {
      email?: string;
      email_verified?: boolean;
      display_name?: string;
      avatar_url?: string;
    } = {};

    if (existing.email !== profile.email) updates.email = profile.email;
    if (existing.email_verified !== profile.emailVerified) {
      updates.email_verified = profile.emailVerified;
    }
    if (profile.name && existing.display_name !== profile.name) {
      updates.display_name = profile.name;
    }
    if (profile.picture && existing.avatar_url !== profile.picture) {
      updates.avatar_url = profile.picture;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.authIdentity.update({
        where: { identity_id: existing.identity_id },
        data: updates,
      });
    }

    const userUpdates: { email?: string; name?: string } = {};
    if (profile.email && existing.user.email !== profile.email) {
      userUpdates.email = profile.email;
    }
    if (profile.name && existing.user.name !== profile.name) {
      userUpdates.name = profile.name;
    }
    if (Object.keys(userUpdates).length > 0) {
      const user = await prisma.user.update({
        where: { user_id: existing.user.user_id },
        data: userUpdates,
      });
      return { user, isNew: false };
    }

    return { user: existing.user, isNew: false };
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: defaultDisplayName(profile),
          email: profile.email,
          type: "user",
          status: "active",
        },
      });

      await tx.authIdentity.create({
        data: {
          user_id: created.user_id,
          provider: GOOGLE_PROVIDER,
          provider_subject: profile.sub,
          email: profile.email,
          email_verified: profile.emailVerified,
          display_name: profile.name,
          avatar_url: profile.picture,
        },
      });

      return created;
    });

    return { user, isNew: true };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: string }).code)
        : "";
    if (code !== "P2002") throw err;

    const raced = await prisma.authIdentity.findUnique({
      where: {
        provider_provider_subject: {
          provider: GOOGLE_PROVIDER,
          provider_subject: profile.sub,
        },
      },
      include: { user: true },
    });
    if (!raced) throw err;
    return { user: raced.user, isNew: false };
  }
}
