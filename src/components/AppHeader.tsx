"use client";

import { FallbackNextImage } from "src/components/FallbackNextImage";
import Link from "next/link";

import { AccountSlideOverTrigger } from "src/components/AccountSlideOver";

type AppHeaderProps = {
  /** Texto opcional centrado (p. ej. "Centro admin"). */
  title?: string;
  /** Slot opcional a la derecha; por defecto muestra el acceso a la cuenta. */
  right?: React.ReactNode;
};

/**
 * Cabecera compartida para las páginas internas (feed, recompensas, cuenta…).
 * Mantiene marca, ancho (max-w-[600px]) y estilo (sticky + blur) consistentes
 * para que todas las vistas se sientan parte de la misma app.
 */
export function AppHeader({ title, right }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-tonki-chrome-border bg-tonki-chrome/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2.5 text-tonki-chrome-text transition-colors hover:text-tonki-accent"
        >
          <FallbackNextImage src="/logo.png" alt="Tonki" width={32} height={32} priority />
          <span className="text-lg font-bold tracking-tight">Tonki</span>
        </Link>

        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-center text-[15px] font-bold leading-snug text-tonki-chrome-text sm:text-[17px]">
            {title}
          </h1>
        ) : null}

        {right ?? (
          <AccountSlideOverTrigger className="min-w-0 max-w-[min(200px,45vw)] shrink-0 truncate text-right text-sm font-medium text-tonki-chrome-text-muted transition-colors hover:text-tonki-chrome-text-secondary sm:text-base" />
        )}
      </div>
    </header>
  );
}
