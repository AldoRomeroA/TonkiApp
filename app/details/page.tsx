import Link from "next/link";
import Image from "next/image";

export default function DetailsPage() {
  return (
    <main className="min-h-screen bg-[#0B0B0B] text-white px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#F6C941]">Tonki</h1>
          <p className="mt-3 text-lg text-neutral-300">
            Connecting hives, distributing value.
          </p>
        </header>

        <div className="mb-12 overflow-hidden rounded-2xl border border-[#2a2a2a]">
          <Image
            src="/tonki-details.png"
            alt="Infografia de propuesta de valor Tonki"
            width={768}
            height={1092}
            className="h-auto w-full object-cover"
            priority
          />
        </div>

        <section className="space-y-8">
          <article>
            <h2 className="text-2xl font-semibold text-[#F6C941] mb-3">
              El Problema
            </h2>
            <p className="text-neutral-200 leading-relaxed">
              Mas del 90% de la inversion en publicidad no genera el ROI
              esperado. Retener un cliente es hasta 5 veces mas barato que
              adquirir uno nuevo. Despues del COVID, el costo de adquisicion
              aumento +15% en 2024.
            </p>
          </article>

          <article>
            <h2 className="text-2xl font-semibold text-[#F6C941] mb-3">
              La Solucion
            </h2>
            <p className="text-neutral-200 leading-relaxed">
              Tonki convierte el marketing en comportamiento medible. En lugar
              de pagar por impresiones, los negocios envian recompensas directas
              (XLM/USDC) a sus clientes. Esto permite reactivar clientes
              inactivos, premiar clientes frecuentes y lanzar campanas
              dirigidas.
            </p>
          </article>

          <article>
            <h2 className="text-2xl font-semibold text-[#F6C941] mb-3">
              Implementacion
            </h2>
            <p className="text-neutral-200 leading-relaxed">
              Cada Peso / Dolar esta ligado a una accion medible: frecuencia,
              ticket promedio y nivel de lealtad. Tonki identifica clientes top,
              inactivos y nuevos, y los activa con incentivos. Todo esto se
              integra con wallets no custodiales y on/off ramp en mainnet
              (Stellar).
            </p>
          </article>

          <article>
            <h2 className="text-2xl font-semibold text-[#F6C941] mb-3">
              Modelo de Negocio
            </h2>
            <p className="text-neutral-200 leading-relaxed">
              Tonki es un SaaS con planes desde 17 USD hasta 100 USD, con
              despliegue de airdrops, cashback y beneficios adicionales como
              agentes de IA enfocados en marketing.
            </p>
          </article>
        </section>

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-[#F6C941] px-5 py-3 text-[#F6C941] hover:bg-[#F6C941] hover:text-black transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
