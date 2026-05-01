"use client";
import Image from "next/image";
import { useState } from "react";

const carouselImages = [
  "/carousel/tonki_1.jpeg",
  "/carousel/tonki_2.jpeg",
];

export default function Details() {
  const [current, setCurrent] = useState(0);

  const nextSlide = () => setCurrent((prev) => (prev + 1) % carouselImages.length);
  const prevSlide = () => setCurrent((prev) => (prev - 1 + carouselImages.length) % carouselImages.length);

  return (
    <main className="min-h-screen bg-[#0B0B0B] text-white flex flex-col items-center">

      {/* Nav para volver */}
      <header className="w-full flex justify-between items-center p-6">
      <div className="flex items-center space-x-2">
          <Image src="/logo.png" alt="Tonki Logo" width={50} height={50} />
          <span className="text-xl font-bold text-[#FFF]">Tonki</span>
        </div>
        <nav>
          <a
            href="/"
            className="px-4 py-2 bg-[#F6C941] text-black rounded-lg hover:bg-yellow-400"
          >
            ← Volver a Inicio
          </a>
        </nav>
      </header>

      {/* Logo grande */}
      <div className="mt-10">
        <Image src="/logo.png" alt="Tonki Logo" width={200} height={200} />
      </div>

      {/* Carrusel */}
      <div className="relative w-full max-w-3xl mt-10">
        <Image
          src={carouselImages[current]}
          alt={`Slide ${current}`}
          width={800}
          height={400}
          className="rounded-lg"
        />
        <button
          onClick={prevSlide}
          className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-[#F6C941] text-black px-3 py-1 rounded"
        >
          ‹
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-[#F6C941] text-black px-3 py-1 rounded"
        >
          ›
        </button>
      </div>

      {/* Contenido */}
      <section className="max-w-4xl px-6 py-12 space-y-8">
        <h1 className="text-4xl font-bold text-[#F6C941] text-center">Tonki</h1>
        <p className="text-lg text-gray-300 text-center">
          Connecting hives, distributing value.
        </p>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-[#F6C941]">El Problema</h2>
          <p className="text-gray-300">
            Más del 90% de la inversión en publicidad no genera el ROI esperado. 
            Retener un cliente es hasta 5 veces más barato que adquirir uno nuevo. 
            Después del COVID, el costo de adquisición aumentó +15% en 2024.
          </p>

          <h2 className="text-2xl font-semibold text-[#F6C941]">La Solución</h2>
          <p className="text-gray-300">
            Tonki convierte el marketing en comportamiento medible. 
            En lugar de pagar por impresiones, los negocios envían recompensas directas (XLM/USDC) a sus clientes. 
            Esto permite reactivar clientes inactivos, premiar clientes frecuentes y lanzar campañas dirigidas.
          </p>

          <h2 className="text-2xl font-semibold text-[#F6C941]">Implementación</h2>
          <p className="text-gray-300">
            Cada Peso / Dólar está ligado a una acción medible: frecuencia, ticket promedio y nivel de lealtad. 
            Tonki identifica clientes top, inactivos y nuevos, y los activa con incentivos. 
            Todo esto se integra con wallets no custodiales y on/off ramp en mainnet (Stellar).
          </p>

          <h2 className="text-2xl font-semibold text-[#F6C941]">Modelo de Negocio</h2>
          <p className="text-gray-300">
            Tonki es un SaaS con planes desde 17 USD hasta 100 USD, 
            con despliege de airdrops, cashback y beneficios adicionales como agentes de IA enfocados en marketing.
          </p>
        </div>
      </section>
    </main>
  );
}