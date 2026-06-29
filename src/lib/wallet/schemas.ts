import { z } from "zod";

const stellarContractAddress = z
  .string()
  .trim()
  .regex(/^C[A-Z0-9]{55}$/, "contract_address inválida");

export const walletCreateSchema = z.object({
  contractAddress: stellarContractAddress,
  credentialId: z.string().trim().min(1).max(512),
  publicKey: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => {
      try {
        const bytes = Buffer.from(value, "base64");
        return bytes.length === 65 && bytes[0] === 0x04;
      } catch {
        return false;
      }
    }, "public_key debe ser una clave secp256r1 sin comprimir (65 bytes, base64)"),
  publicKeyAlgorithm: z.number().int().optional(),
  transports: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  deviceLabel: z.string().trim().min(1).max(100).optional(),
  deploymentTxHash: z.string().trim().min(1).max(128).optional(),
});

export type WalletCreateInput = z.infer<typeof walletCreateSchema>;
