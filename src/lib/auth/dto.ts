import type { PublicUser } from "src/types/auth";

export type PublicUserDTO = PublicUser;

type UserLike = {
  user_id: string;
  email: string | null;
};

export function toPublicUserDTO(
  user: UserLike,
  username: string | null
): PublicUserDTO {
  return {
    id: user.user_id,
    email: user.email,
    username,
  };
}
