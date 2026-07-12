import { z } from "zod";
import type {
  LoginRequest,
  WalletLoginRequest,
  WalletRegisterRequest,
} from "src/types/auth";

export const passwordLoginSchema = z.object({
  username: z.string().trim().min(1, "username requerido").max(200),
  password: z.string().min(1, "password requerido").max(500),
}) satisfies z.ZodType<LoginRequest>;

export const walletLoginSchema = z.object({
  publicKey: z.string().trim().min(1, "publicKey requerido").max(80),
  signature: z.string().trim().min(1, "signature requerida").max(2048),
}) satisfies z.ZodType<WalletLoginRequest>;

const isoDateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida")
  .refine((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const dt = new Date(Date.UTC(y!, m! - 1, d!));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m! - 1 &&
      dt.getUTCDate() === d
    );
  }, "fecha inválida");

export const walletRegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .email("correo inválido")
    .max(100, "correo demasiado largo"),
  birthDate: isoDateOnly,
  name: z.string().trim().min(1).max(100).optional(),
}) satisfies z.ZodType<WalletRegisterRequest>;

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;
export type WalletLoginInput = z.infer<typeof walletLoginSchema>;
export type WalletRegisterInput = z.infer<typeof walletRegisterSchema>;
