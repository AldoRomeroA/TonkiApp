"use client";

import Link from "next/link";

import { AccountSlideOverTrigger } from "src/components/AccountSlideOver";

const ADMIN_LOGO = "/Logos-Tonki-SVG/Isotipo amarillo-crema.svg";

type AdminHeaderProps = {
  /** Texto opcional centrado (p. ej. "Airdrop"). */
  title?: string;
  /** Slot opcional a la derecha; por defecto muestra el acceso a la cuenta. */
  right?: React.ReactNode;
};

/**
 * Cabecera exclusiva del área admin (/admin/*).
 * No reutiliza AppHeader del feed/cuenta; usa el isotipo admin.
 */
export function AdminHeader({ title, right }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-tonki-chrome-border bg-tonki-chrome backdrop-blur-md">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/admin/dashboard"
          className="flex shrink-0 items-center gap-2.5 text-tonki-chrome-text transition-colors hover:text-tonki-accent"
        >
          <img
            src={ADMIN_LOGO}
            alt="Tonki Admin"
            width={32}
            height={32}
            className="h-8 w-8"
          />
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
