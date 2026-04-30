import { z } from "zod";
import type { LoginRequest, WalletLoginRequest } from "src/types/auth";

export const passwordLoginSchema = z.object({
  username: z.string().trim().min(1, "username requerido"),
  password: z.string().min(1, "password requerido"),
}) satisfies z.ZodType<LoginRequest>;

export const walletLoginSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey requerido"),
  signature: z.string().trim().min(1, "signature requerida"),
}) satisfies z.ZodType<WalletLoginRequest>;

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type WalletLoginInput = z.infer<typeof walletLoginSchema>;
