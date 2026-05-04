import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-tonki-canvas px-6 py-12 text-center text-tonki-text-secondary">
      <h1 className="text-3xl font-bold tracking-tight text-tonki-accent sm:text-4xl">
        Página no encontrada
      </h1>
      <p className="max-w-md text-base leading-relaxed">
        La ruta que buscas no existe o fue movida. Vuelve al inicio para seguir
        navegando.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-tonki-accent px-8 py-3 text-base font-semibold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
