export type UserRole = "admin" | "user";

export interface PublicUser {
  id: string;
  email: string | null;
  username: string | null;
}

export interface AuthResponse {
  message: string;
  user: PublicUser;
  role: UserRole;
  redirectTo: string;
}

/** Success body for `GET /api/auth/me` (wrapped with `success: true` by the API helper). */
export interface AuthMeResponse {
  user: PublicUser;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface WalletLoginRequest {
  publicKey: string;
  signature: string;
}

/** Wrapped by `apiSuccess`: `{ success: true, user, role }` */
export interface AuthMePayload {
  user: PublicUser;
  role: UserRole;
}
