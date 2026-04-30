import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0B0B0B] text-white">
      {/* Header con logo */}
      <header className="w-full flex justify-between items-center p-6">
        <div className="flex items-center space-x-2">
          <Image src="/logo.png" alt="Tonki Logo" width={60} height={60} />
          <span className="text-xl font-bold text-[#FFF]">Tonki</span>
        </div>
        <nav className="space-x-6">
          <Link href="/details" className="hover:text-[#F6C941]">
            Características
          </Link>
          <a href="#contact" className="hover:text-[#F6C941]">
            Contacto
          </a>
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
          <Link
            href="/login"
            className="px-6 py-3 bg-[#F6C941] text-black font-semibold rounded-lg hover:bg-yellow-400"
          >
            Empieza ahora
          </Link>
          <Link
            href="/details"
            className="px-6 py-3 border border-[#F6C941] text-[#F6C941] rounded-lg hover:bg-[#F6C941] hover:text-black"
          >
            Saber más
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto w-full text-center p-6 text-gray-400">
        © {new Date().getFullYear()} Tonki. Todos los derechos reservados.
      </footer>
    </main>
  );
}
