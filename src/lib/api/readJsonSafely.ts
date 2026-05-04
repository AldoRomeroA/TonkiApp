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
