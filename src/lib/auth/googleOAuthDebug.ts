/**
 * In-memory last Google OAuth callback failures (safe, no secrets).
 * Exposed via /api/auth/google/config-check for Hostinger diagnosis.
 */

export type GoogleOAuthFailureRecord = {
  at: string;
  stage: string;
  errorCode: string;
  errName: string | null;
  errMessage: string | null;
  prismaCode: string | null;
};

const MAX = 8;
const failures: GoogleOAuthFailureRecord[] = [];

export function recordGoogleOAuthFailure(
  entry: Omit<GoogleOAuthFailureRecord, "at">
): void {
  failures.unshift({
    ...entry,
    at: new Date().toISOString(),
  });
  if (failures.length > MAX) failures.length = MAX;
}

export function getRecentGoogleOAuthFailures(): GoogleOAuthFailureRecord[] {
  return [...failures];
}

export function sanitizeErrorMessage(err: unknown): {
  errName: string | null;
  errMessage: string | null;
  prismaCode: string | null;
} {
  const errName = err instanceof Error ? err.name : null;
  let errMessage = err instanceof Error ? err.message : String(err);
  // Strip anything that could look like a secret / long token
  errMessage = errMessage.replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]");
  if (errMessage.length > 180) errMessage = `${errMessage.slice(0, 180)}…`;

  let prismaCode: string | null = null;
  if (err && typeof err === "object" && "code" in err) {
    prismaCode = String((err as { code: unknown }).code);
  }

  return { errName, errMessage, prismaCode };
}
