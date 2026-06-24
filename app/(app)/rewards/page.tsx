import type { Metadata } from "next";

import { RewardsExperience } from "./RewardsExperience";

export const metadata: Metadata = {
  title: "Tonki — Recompensas",
  description:
    "Canjea tus puntos por recompensas exclusivas y compite en la tabla de líderes de Tonki.",
};

export default function RewardsPage() {
  return <RewardsExperience />;
}
