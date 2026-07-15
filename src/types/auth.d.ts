export type UserRole = "admin" | "user";

export interface PublicUser {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  first_name: string | null;
  paternal_surname: string | null;
  maternal_surname: string | null;
  birth_date: string | null;
  wallet_address: string | null;
  avatar_url: string | null;
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

/** Returned when Freighter signature is valid but the wallet is not registered yet. */
export interface WalletNeedsRegistrationResponse {
  needsRegistration: true;
  publicKey: string;
  message: string;
}

export interface WalletRegisterRequest {
  email: string;
  birthDate: string;
  name?: string;
}

export interface ProfileUpdateRequest {
  email: string;
  first_name: string;
  paternal_surname?: string;
  maternal_surname?: string;
  birthDate: string;
}

/** Wrapped by `apiSuccess`: `{ success: true, user, role }` */
export interface AuthMePayload {
  user: PublicUser;
  role: UserRole;
}
