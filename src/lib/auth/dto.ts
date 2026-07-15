import type { PublicUser } from "src/types/auth";

export type PublicUserDTO = PublicUser;

type UserLike = {
  user_id: string;
  email: string | null;
  name?: string | null;
  first_name?: string | null;
  paternal_surname?: string | null;
  maternal_surname?: string | null;
  birth_date?: Date | null;
  wallet_address?: string | null;
  avatar_url?: string | null;
};

function formatBirthDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function composeDisplayName(
  firstName: string,
  paternalSurname?: string | null,
  maternalSurname?: string | null
): string {
  return [firstName, paternalSurname, maternalSurname]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0)
    .join(" ")
    .slice(0, 100);
}

export function toPublicUserDTO(
  user: UserLike,
  username: string | null
): PublicUserDTO {
  return {
    id: user.user_id,
    email: user.email,
    username,
    name: user.name ?? null,
    first_name: user.first_name ?? null,
    paternal_surname: user.paternal_surname ?? null,
    maternal_surname: user.maternal_surname ?? null,
    birth_date: formatBirthDate(user.birth_date),
    wallet_address: user.wallet_address ?? null,
    avatar_url: user.avatar_url ?? null,
  };
}
