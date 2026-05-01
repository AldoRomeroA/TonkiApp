"use client";
import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [openDropdown, setOpenDropdown] = useState(false);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0B] text-white">
      {/* Header con logo */}
      <header className="w-full flex justify-between items-center p-6 relative">
        <div className="flex items-center space-x-2">
          <Image src="/logo.png" alt="Tonki Logo" width={50} height={50} />
          <span className="text-xl font-bold text-[#FFF]">Tonki</span>
        </div>
        <nav className="space-x-6 relative">
          <a href="/details" className="hover:text-[#F6C941]">
            Características
          </a>
          <button
            onClick={() => setOpenDropdown(!openDropdown)}
            className="hover:text-[#F6C941] focus:outline-none"
          >
            Contacto
          </button>

          {/* Dropdown */}
          {openDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-[#0B0B0B] border border-[#F6C941] rounded-lg shadow-lg">
              <a
                href="https://wa.me/5517424570?text=Me%20gustaría%20recibir%20más%20información."
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 hover:bg-[#F6C941] hover:text-black"
              >
                WhatsApp
              </a>
              <a
                href="mailto:support@tonki.io"
                className="block px-4 py-2 hover:bg-[#F6C941] hover:text-black"
              >
                Correo
              </a>
            </div>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col items-center text-center px-6 py-20">
        <h1 className="text-4xl md:text-6xl font-bold text-[#F6C941]">
          Recompensas simples para negocios locales
        </h1>
        <p className="mt-6 max-w-xl text-lg text-gray-300">
          Con Tonki, tus clientes acumulan puntos y tus ventas crecen. Una
          plataforma fácil, rápida y atractiva.
        </p>
        <div className="mt-8 flex space-x-4">
          <button 
            onClick={() => (window.location.href = "/login")}
            className="px-6 py-3 bg-[#F6C941] text-black font-semibold rounded-lg hover:bg-yellow-400"
          >
            Empieza ahora
          </button>
          <button
            onClick={() => (window.location.href = "/details")}
            className="px-6 py-3 border border-[#F6C941] text-[#F6C941] rounded-lg hover:bg-[#F6C941] hover:text-black"
          >
            Saber más
          </button>

        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto w-full text-center p-6 text-gray-400">
        © {new Date().getFullYear()} Tonki. Todos los derechos reservados.
      </footer>
    </main>
  );
}