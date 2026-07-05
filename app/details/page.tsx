import { FallbackNextImage } from "src/components/FallbackNextImage";
import Link from "next/link";
import {
  IconInstagram,
  IconX,
  socialIconLinkClass,
} from "@/src/components/SocialIcons";

export default function DetailsPage() {
  return (
    <main className="min-h-screen bg-tonki-canvas px-6 py-12 text-tonki-text sm:px-8 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-12 text-center sm:mb-16">
          <h1 className="text-4xl font-bold tracking-tight text-tonki-accent md:text-5xl lg:text-6xl">
            Tonki
          </h1>
          <p className="mt-4 text-lg text-tonki-text-secondary md:text-xl">
            Conectamos colmenas, distribuimos valor.
          </p>
        </header>

        <div className="mb-12 overflow-hidden rounded-2xl border border-tonki-border sm:mb-16">
          <FallbackNextImage
            src="/tonki-details.png"
            alt="Infografia de propuesta de valor Tonki"
            width={768}
            height={1092}
            className="h-auto w-full object-cover"
            priority
          />
        </div>

        <section className="space-y-12 sm:space-y-16">
          <article>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
              El Problema
            </h2>
            <p className="text-base leading-relaxed text-tonki-text-secondary md:text-lg">
              Más del 90&nbsp;% de la inversión en publicidad no genera el ROI
              esperado. Retener un cliente es hasta 5&nbsp;veces más barato que
              adquirir uno nuevo. Después del COVID, el costo de adquisición
              aumentó +15&nbsp;% en 2024.
            </p>
          </article>

          <article>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
              La Solucion
            </h2>
            <p className="text-base leading-relaxed text-tonki-text-secondary md:text-lg">
              Tonki convierte el marketing en comportamiento medible. En lugar
              de pagar por impresiones, los negocios envían recompensas directas
              (XLM/USDC) a sus clientes. Esto permite reactivar clientes
              inactivos, premiar clientes frecuentes y lanzar campañas
              dirigidas.
            </p>
          </article>

          <article>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
              Implementación
            </h2>
            <p className="text-base leading-relaxed text-tonki-text-secondary md:text-lg">
              Cada peso / dólar está ligado a una acción medible: frecuencia,
              ticket promedio y nivel de lealtad. Tonki identifica clientes top,
              inactivos y nuevos, y los activa con incentivos. Todo esto se
              integra con wallets no custodiales y on/off ramp en mainnet
              (Stellar).
            </p>
          </article>

          <article>
            <h2 className="mb-4 text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
              Modelo de Negocio
            </h2>
            <p className="text-base leading-relaxed text-tonki-text-secondary md:text-lg">
              Tonki es un SaaS con planes desde 17 USD hasta 100 USD, con
              despliegue de airdrops, cashback y beneficios adicionales como
              agentes de IA enfocados en marketing.
            </p>
          </article>
        </section>

        <section className="mt-12 rounded-2xl border border-tonki-border bg-tonki-surface p-8 text-center shadow-sm sm:mt-16 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-tonki-accent md:text-3xl">
            Contacto y redes
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-tonki-text-secondary md:text-lg">
            ¿Preguntas o colaboraciones? Escríbenos o síguenos.
          </p>
          <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
            <a
              href="mailto:support@tonki.io?subject=Consulta%20Tonki"
              className="text-base font-semibold text-tonki-accent underline-offset-4 transition-colors hover:text-tonki-accent-hover hover:underline"
            >
              support@tonki.io
            </a>
            <nav
              aria-label="Redes sociales Tonki"
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <a
                href="https://www.instagram.com/tonkiapp/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Tonki en Instagram"
                title="Instagram"
                className={socialIconLinkClass}
              >
                <IconInstagram className="h-5 w-5" />
              </a>
              <a
                href="https://x.com/Tonkiapp"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Tonki en X"
                title="X"
                className={socialIconLinkClass}
              >
                <IconX className="h-[1.125rem] w-[1.125rem]" />
              </a>
            </nav>
          </div>
        </section>

        <div className="mt-12 sm:mt-16">
          <Link
            href="/"
            className="inline-flex rounded-xl border border-tonki-border-strong px-6 py-3 text-base font-semibold text-tonki-accent transition-colors hover:border-tonki-accent hover:bg-tonki-accent/10"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
