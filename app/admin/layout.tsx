import { AccountSlideOverGroup } from "src/components/AccountSlideOver";
import { BottomNavbar } from "src/components/BottomNavbar";

import { AdminHeader } from "./AdminHeader";

/**
 * Layout compartido para rutas de administrador (/admin/dashboard, /admin/airdrop, …).
 * Incluye cabecera admin propia (no AppHeader del feed).
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AccountSlideOverGroup>
      <div className="min-h-screen bg-tonki-canvas text-tonki-text pb-[calc(72px+env(safe-area-inset-bottom))]">
        <AdminHeader />
        {children}
        <BottomNavbar />
      </div>
    </AccountSlideOverGroup>
  );
}
