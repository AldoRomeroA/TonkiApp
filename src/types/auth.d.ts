export type UserRole = "admin" | "user";

export interface PublicUser {
  id: string;
  email: string | null;
  username: string | null;
}

export interface AuthResponse {
  message: string;
  user: PublicUser;
  redirectTo: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface WalletLoginRequest {
  publicKey: string;
  signature: string;
}
