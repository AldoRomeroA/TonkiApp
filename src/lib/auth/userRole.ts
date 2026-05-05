import type { UserRole } from "src/types/auth";

/** Interpreta `User.type` de BD solo si coincide con valores de sesión soportados. */
export function normalizeUserRole(
  raw: string | null | undefined
): UserRole | null {
  if (raw === "admin" || raw === "user") return raw;
  return null;
}
