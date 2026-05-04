import { apiSuccess } from "src/lib/api/response";
import { clearSessionCookie } from "src/lib/auth/session";

export async function POST() {
  const res = apiSuccess({ message: "Sesión cerrada" });
  clearSessionCookie(res);
  return res;
}
