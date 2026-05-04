import type { NextResponse } from "next/server";
import { apiError } from "src/lib/api/response";

/**
 * Loguea el error y en desarrollo devuelve mensajes accionables (config / DB).
 */
export function logAndRespondAuthInfrastructureError(
  routeLabel: string,
  err: unknown
): NextResponse | null {
  console.error(routeLabel, err);

  if (process.env.NODE_ENV !== "development") return null;

  const msg = err instanceof Error ? err.message : String(err);

  if (
    msg.includes("Environment variable not found: DATABASE_URL") ||
    (msg.includes("DATABASE_URL") && msg.includes("not found"))
  ) {
    return apiError(
      "Falta DATABASE_URL. Copia .env.example a .env.local y define la cadena MySQL.",
      503
    );
  }

  if (
    /P1001|P1003|P1017/i.test(msg) ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("Can't reach database server")
  ) {
    return apiError(
      "No hay conexión con MySQL. Revisa DATABASE_URL y que la base esté en marcha (p. ej. Docker). Ejecuta: npx prisma migrate dev",
      503
    );
  }

  return null;
}
