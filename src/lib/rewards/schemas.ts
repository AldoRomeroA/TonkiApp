import { z } from "zod";

export const establishmentRewardUpdateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Título requerido")
    .max(150, "Título demasiado largo"),
  short_description: z
    .string()
    .trim()
    .min(1, "Descripción corta requerida")
    .max(255, "Descripción corta demasiado larga"),
  long_description: z
    .string()
    .trim()
    .max(5_000, "Descripción larga demasiado larga")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  value_tonkis: z.coerce
    .number()
    .int("Tonkis debe ser entero")
    .min(1, "Mínimo 1 tonki")
    .max(1_000_000, "Valor en tonkis demasiado alto"),
  value_usd: z.coerce
    .number()
    .min(0, "El valor en $ no puede ser negativo")
    .max(1_000_000, "Valor en $ demasiado alto"),
});

export type EstablishmentRewardUpdateInput = z.infer<
  typeof establishmentRewardUpdateSchema
>;
