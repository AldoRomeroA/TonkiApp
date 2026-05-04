export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-tonki-canvas text-tonki-text-muted">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-tonki-border border-t-tonki-accent"
        aria-hidden
      />
      <p className="mt-4 text-sm">Cargando…</p>
    </div>
  );
}
