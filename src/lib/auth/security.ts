export const AUTH_FAILURE_DELAY_MS = 600;

export async function applyAuthFailureDelay() {
  await new Promise((resolve) => setTimeout(resolve, AUTH_FAILURE_DELAY_MS));
}
