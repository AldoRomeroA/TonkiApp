import { Suspense } from "react";
import { WalletOnboardingClient } from "./WalletOnboardingClient";

export default function WalletOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-tonki-canvas">
          <p className="text-sm text-tonki-text-muted">Cargando…</p>
        </div>
      }
    >
      <WalletOnboardingClient />
    </Suspense>
  );
}
