"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type SVGProps } from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { UserRole } from "src/types/auth";

type IconProps = SVGProps<SVGSVGElement>;

type NavItem = {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.ReactElement;
};

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Feed", Icon: IconHome },
  { href: "/rewards", label: "Recompensas", Icon: IconGift },
  { href: "/account", label: "Cuenta", Icon: IconUser },
];

const ADMIN_AIRDROP_ITEM: NavItem = {
  href: "/admin/airdrop",
  label: "Airdrop",
  Icon: IconAirdrop,
};

/**
 * Barra de navegación inferior mobile-first.
 * - Fija al fondo con soporte de Safe Area (notch / home indicator) vía env(safe-area-inset-bottom).
 * - Glassmorphism (backdrop-blur) + sombra superior sutil para separarse del contenido.
 * - Área de tap mínima de 48x48px y estado activo con color + punto indicador animado.
 */
export function BottomNavbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await readJsonSafely<{
          success?: boolean;
          role?: UserRole;
        }>(res);
        if (cancelled || !res.ok || !data?.success || !data.role) return;
        setRole(data.role);
      } catch {
        // Mantener navegación base si falla la sesión.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo(() => {
    if (role !== "admin") return BASE_NAV_ITEMS;
    return [
      BASE_NAV_ITEMS[0],
      BASE_NAV_ITEMS[1],
      ADMIN_AIRDROP_ITEM,
      BASE_NAV_ITEMS[2],
    ];
  }, [role]);

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-tonki-chrome-border bg-tonki-chrome/95 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl backdrop-saturate-150 [padding-bottom:env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex w-full items-stretch justify-around px-1 sm:px-2">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className="group relative mx-auto flex min-h-[56px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-tonki-chrome-text-muted transition-colors duration-200 hover:text-tonki-chrome-text-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tonki-accent/60 data-[active=true]:text-tonki-accent sm:min-w-[48px] sm:px-2"
                data-active={isActive}
              >
                <Icon
                  className="h-6 w-6 shrink-0 transition-transform duration-200 group-active:scale-90"
                  aria-hidden
                />
                <span className="max-w-full truncate text-[10px] font-semibold leading-none sm:text-[11px]">
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

function IconAirdrop({ className, ...props }: IconProps) {
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
      <path d="M8 17h8" />
    </svg>
  );
}
