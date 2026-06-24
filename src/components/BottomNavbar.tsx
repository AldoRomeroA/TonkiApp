"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

type NavItem = {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Feed", Icon: IconHome },
  { href: "/rewards", label: "Recompensas", Icon: IconGift },
  { href: "/account", label: "Cuenta", Icon: IconUser },
];

/**
 * Barra de navegación inferior mobile-first.
 * - Fija al fondo con soporte de Safe Area (notch / home indicator) vía env(safe-area-inset-bottom).
 * - Glassmorphism (backdrop-blur) + sombra superior sutil para separarse del contenido.
 * - Área de tap mínima de 48x48px y estado activo con color + punto indicador animado.
 */
export function BottomNavbar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-tonki-border bg-tonki-surface/70 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl backdrop-saturate-150 [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full max-w-[600px] items-stretch justify-around px-2">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className="group relative mx-auto flex min-h-[56px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-tonki-text-muted transition-colors duration-200 hover:text-tonki-text-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tonki-accent/60 data-[active=true]:text-tonki-accent"
                data-active={isActive}
              >
                <Icon
                  className="h-6 w-6 transition-transform duration-200 group-active:scale-90"
                  aria-hidden
                />
                <span className="text-[11px] font-semibold leading-none">
                  {label}
                </span>

                {isActive ? (
                  <motion.span
                    layoutId="bottom-nav-active-dot"
                    className="absolute -top-px h-1 w-8 rounded-full bg-tonki-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 32 }}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function IconHome({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

function IconGift({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x={3} y={8} width={18} height={4} rx={1} />
      <path d="M12 8v13" />
      <path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />
      <path d="M12 8C12 8 11 3 8 3a2.5 2.5 0 0 0 0 5h4Z" />
      <path d="M12 8c0 0 1-5 4-5a2.5 2.5 0 0 1 0 5h-4Z" />
    </svg>
  );
}

function IconUser({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}
