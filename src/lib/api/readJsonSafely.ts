/** Parsea el cuerpo JSON de un `Request`; devuelve `null` si no es JSON válido. */
export async function parseRequestJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** Consume el cuerpo de `Response` y parsea JSON de forma tolerante a fallos. */
export async function readJsonSafely<T>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
