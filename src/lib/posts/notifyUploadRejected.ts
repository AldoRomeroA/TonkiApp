import { postUploadMaxSizeLabelEs } from "src/lib/posts/constants";

function fileSizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 0.1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(0)} KB`;
}

/** Solo texto para la UI (sin efectos secundarios). */
export function formatPostUploadRejectMessage(rejected: File[]): string {
  if (rejected.length === 0) return "";

  const maxLabel = postUploadMaxSizeLabelEs();
  const lines = rejected.map((f) => {
    const label = f.name?.trim() || "sin nombre";
    return `  · ${label} (${fileSizeLabel(f.size)})`;
  });

  const head =
    rejected.length === 1
      ? "Este archivo supera el máximo por archivo:"
      : `Estos ${rejected.length} archivos superan el máximo por archivo:`;

  return [
    "Límite de peso alcanzado",
    "",
    `Cada archivo puede pesar como máximo ${maxLabel}.`,
    "",
    head,
    ...lines,
  ].join("\n");
}

/**
 * Muestra el diálogo nativo pasado un breve retardo para que no compita con el batch
 * de React ni con el vaciado del input de archivos (varios navegadores).
 */
export function schedulePostUploadWeightAlert(message: string): void {
  if (!message.trim() || typeof window === "undefined") return;
  const text = message;
  window.setTimeout(() => {
    window.alert(text);
  }, 120);
}

/** Formatea, programa el alert y devuelve el mismo texto para `setFeedback` / `setError`. */
export function notifyPostUploadWeightRejected(rejected: File[]): string {
  const msg = formatPostUploadRejectMessage(rejected);
  if (!msg) return "";
  schedulePostUploadWeightAlert(msg);
  return msg;
}
