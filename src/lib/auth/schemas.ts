import { z } from "zod";
import type { LoginRequest, WalletLoginRequest } from "src/types/auth";

export const passwordLoginSchema = z.object({
  username: z.string().trim().min(1, "username requerido").max(200),
  password: z.string().min(1, "password requerido").max(500),
}) satisfies z.ZodType<LoginRequest>;

export const walletLoginSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey requerido").max(80),
  signature: z.string().trim().min(1, "signature requerida").max(2048),
}) satisfies z.ZodType<WalletLoginRequest>;

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type WalletLoginInput = z.infer<typeof walletLoginSchema>;
