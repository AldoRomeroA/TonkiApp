import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-tonki-canvas text-tonki-text">
      <header className="flex w-full items-center justify-between px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Tonki Logo" width={56} height={56} />
          <span className="text-xl font-bold tracking-tight sm:text-2xl">
            Tonki
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm font-medium text-tonki-text-secondary sm:text-base sm:gap-8">
          <Link
            href="/details"
            className="transition-colors hover:text-tonki-accent"
          >
            Características
          </Link>
          <a
            href="#contact"
            className="transition-colors hover:text-tonki-accent"
          >
            Contacto
          </a>
        </nav>
      </header>

      <section className="flex flex-col items-center px-6 py-16 text-center sm:px-8 sm:py-20">
        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-tonki-accent md:text-5xl md:leading-[1.1] lg:text-6xl">
          Recompensas simples para negocios locales
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-tonki-text-secondary md:text-xl">
          Con Tonki, tus clientes acumulan puntos y tus ventas crecen. Una
          plataforma fácil, rápida y atractiva.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-xl bg-tonki-accent px-8 py-3 text-base font-semibold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
          >
            Empieza ahora
          </Link>
          <Link
            href="/details"
            className="rounded-xl border border-tonki-border-strong px-8 py-3 text-base font-semibold text-tonki-text transition-colors hover:border-tonki-accent hover:text-tonki-accent"
          >
            Saber más
          </Link>
        </div>
      </section>

      <section
        id="contact"
        className="w-full max-w-xl px-6 py-16 text-center text-tonki-text-secondary sm:px-8"
      >
        <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
          Contacto
        </h2>
        <p className="text-lg leading-relaxed md:text-xl">
          ¿Quieres que Tonki llegue a tu negocio? Escríbenos y te respondemos
          lo antes posible.
        </p>
        <a
          href="mailto:contacto@tonki.app?subject=Consulta%20Tonki"
          className="mt-8 inline-block text-base font-semibold text-tonki-accent underline-offset-4 transition-colors hover:text-tonki-accent-hover hover:underline"
        >
          contacto@tonki.app
        </a>
      </section>

      <footer className="mt-auto w-full px-6 py-8 text-center text-sm text-tonki-text-muted sm:px-8">
        © {new Date().getFullYear()} Tonki. Todos los derechos reservados.
      </footer>
    </main>
  );
}
