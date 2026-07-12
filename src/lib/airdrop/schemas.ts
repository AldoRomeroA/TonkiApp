import { z } from "zod";

export const airdropConfigBodySchema = z
  .object({
    amount: z.coerce
      .number()
      .positive("El monto debe ser mayor que cero")
      .max(1_000_000_000, "Monto demasiado grande"),
    asset: z.enum(["TONKI", "XLM", "USDC"]).default("TONKI"),
    scheduled_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    scheduled_end_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha final inválida"),
    periodicity_months: z.coerce
      .number()
      .int()
      .min(1, "Mínimo 1 mes")
      .max(12, "Máximo 12 meses"),
    max_users: z.coerce
      .number()
      .int()
      .min(1, "Mínimo 1 usuario")
      .max(10_000, "Demasiados usuarios"),
  })
  .refine(
    (data) =>
      parseAirdropScheduledDate(data.scheduled_end_date).getTime() >=
      parseAirdropScheduledDate(data.scheduled_date).getTime(),
    {
      message: "La fecha final debe ser igual o posterior a la fecha de inicio",
      path: ["scheduled_end_date"],
    }
  );

export type AirdropConfigFormValues = z.infer<typeof airdropConfigBodySchema>;

export const airdropPrepareBodySchema = z.object({
  source_public_key: z
    .string()
    .trim()
    .regex(/^G[A-Z2-7]{55}$/, "Public key Stellar inválida"),
});

export const airdropSendBodySchema = z.object({
  signed_xdr: z.string().trim().min(1, "XDR firmado requerido").max(200_000),
  source_public_key: z
    .string()
    .trim()
    .regex(/^G[A-Z2-7]{55}$/, "Public key Stellar inválida")
    .optional(),
});

export type AirdropPrepareBody = z.infer<typeof airdropPrepareBodySchema>;
export type AirdropSendBody = z.infer<typeof airdropSendBodySchema>;

/** Convierte `YYYY-MM-DD` del formulario a `Date` UTC estable. */
export function parseAirdropScheduledDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

/** Fin del día UTC para el rango de campaña. */
export function parseAirdropScheduledDateEnd(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

/** Valor para `<input type="date">` desde ISO de BD. */
export function formatAirdropDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Etiqueta corta para acordeones: `12 jul 2026 - 30 jul 2026`. */
export function formatCampaignRangeLabel(startIso: string, endIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" };
  const start = new Date(startIso).toLocaleDateString("es", opts);
  const end = new Date(endIso).toLocaleDateString("es", opts);
  return `${start} - ${end}`;
}
