"use client";

import { useEffect, useState, type SVGProps } from "react";

import { readJsonSafely } from "src/lib/api/readJsonSafely";
import type { AuthMePayload } from "src/types/auth";

type ApiEnvelope =
  | (AuthMePayload & { success: true })
  | { success: false; error?: string };

type Reward = {
  id: string;
  name: string;
  partner: string;
  points: number;
  emoji: string;
};

type LeaderboardEntry = {
  rank: 1 | 2 | 3;
  name: string;
  points: number;
  emoji: string;
};

const REWARDS: Reward[] = [
  { id: "coffee", name: "Café gratis", partner: "Tonki Café", points: 250, emoji: "☕" },
  { id: "cinema", name: "Entrada de cine", partner: "Cinemax", points: 1200, emoji: "🎬" },
  { id: "merch", name: "Sudadera exclusiva", partner: "Tonki Store", points: 3000, emoji: "🧥" },
  { id: "burger", name: "Combo burger", partner: "Local Grill", points: 800, emoji: "🍔" },
  { id: "music", name: "1 mes de música", partner: "SoundUp", points: 1500, emoji: "🎧" },
  { id: "voucher", name: "Cupón $10", partner: "Marketplace", points: 600, emoji: "🎟️" },
];

const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 2, name: "Lucía", points: 8420, emoji: "🦊" },
  { rank: 1, name: "Mateo", points: 9650, emoji: "🐯" },
  { rank: 3, name: "Sofía", points: 7310, emoji: "🐼" },
];

function formatPoints(value: number): string {
  return value.toLocaleString("es-MX");
}

export function RewardsExperience() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await readJsonSafely<ApiEnvelope>(res);
        if (cancelled || !res.ok || !data?.success) return;
        const display =
          data.user.username ??
          data.user.email?.split("@")[0] ??
          null;
        setName(display);
      } catch {
        // Keep the generic greeting if the profile can't be loaded.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const greetingName = name ?? "User";

  return (
    <main className="mx-auto w-full px-4 pb-8 pt-6 sm:px-6">
      <Greeting name={greetingName} />
      <BalanceCard />
      <Leaderboard />
      <ExploreRewards />
    </main>
  );
}

function Greeting({ name }: { name: string }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-tonki-text-muted">
          Bienvenido de vuelta
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-tonki-text">
          ¡Hola, {name}!
        </h1>
      </div>
      <button
        type="button"
        aria-label="Notificaciones"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tonki-border bg-tonki-surface text-tonki-text-secondary transition-colors hover:bg-tonki-surface-hover"
      >
        <IconBell className="h-5 w-5" />
        <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-tonki-accent ring-2 ring-tonki-canvas" />
      </button>
    </header>
  );
}

function BalanceCard() {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl bg-tonki-accent p-5 text-tonki-accent-fg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-tonki-accent-fg/70">
            Tus Tonki Points
          </p>
          <p className="mt-1 text-4xl font-bold tracking-tight">4,280</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tonki-accent-fg/10 text-3xl">
          🪙
        </span>
      </div>
      <p className="mt-4 text-sm font-medium text-tonki-accent-fg/80">
        Te faltan <span className="font-bold text-tonki-accent-fg">220 pts</span>{" "}
        para tu próxima recompensa.
      </p>
    </section>
  );
}

function Leaderboard() {
  const ordered = [...LEADERBOARD].sort((a, b) => a.rank - b.rank);
  return (
    <section className="mt-8">
      <SectionHeading title="Tabla de líderes" action="Ver todo" />
      <div className="mt-4 flex items-end justify-center gap-3 rounded-2xl border border-tonki-border bg-tonki-surface p-5">
        {[ordered[1], ordered[0], ordered[2]].map((entry) =>
          entry ? <PodiumItem key={entry.rank} entry={entry} /> : null
        )}
      </div>
    </section>
  );
}

const PODIUM_STYLE: Record<
  1 | 2 | 3,
  { ring: string; size: string; lift: string; medal: string }
> = {
  1: { ring: "ring-tonki-accent", size: "h-20 w-20", lift: "-mt-4", medal: "🥇" },
  2: { ring: "ring-tonki-border-strong", size: "h-16 w-16", lift: "mt-2", medal: "🥈" },
  3: { ring: "ring-tonki-border-strong", size: "h-16 w-16", lift: "mt-2", medal: "🥉" },
};

function PodiumItem({ entry }: { entry: LeaderboardEntry }) {
  const style = PODIUM_STYLE[entry.rank];
  return (
    <div className={`flex w-1/3 flex-col items-center ${style.lift}`}>
      <div className="relative">
        <span
          className={`flex ${style.size} items-center justify-center rounded-full bg-tonki-elevated text-3xl ring-2 ${style.ring}`}
        >
          {entry.emoji}
        </span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-lg">
          {style.medal}
        </span>
      </div>
      <p className="mt-3 max-w-full truncate text-sm font-semibold text-tonki-text">
        {entry.name}
      </p>
      <p className="text-xs font-medium text-tonki-text-muted">
        {formatPoints(entry.points)} pts
      </p>
    </div>
  );
}

function ExploreRewards() {
  return (
    <section className="mt-8">
      <SectionHeading title="Explora recompensas" action="Ver todo" />
      <div className="mt-4 grid grid-cols-2 gap-4">
        {REWARDS.map((reward) => (
          <RewardCard key={reward.id} reward={reward} />
        ))}
      </div>
    </section>
  );
}

function RewardCard({ reward }: { reward: Reward }) {
  return (
    <article className="flex flex-col rounded-2xl border border-tonki-border bg-tonki-surface p-3 transition-colors hover:bg-tonki-surface-hover">
      <div className="flex h-24 items-center justify-center rounded-xl bg-tonki-elevated text-4xl">
        {reward.emoji}
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <h3 className="text-sm font-bold leading-snug tracking-tight text-tonki-text">
          {reward.name}
        </h3>
        <p className="mt-0.5 text-xs font-medium text-tonki-text-muted">
          {reward.partner}
        </p>
        <div className="mt-3 flex items-center gap-1">
          <span className="text-base">🪙</span>
          <span className="text-sm font-bold text-tonki-text">
            {formatPoints(reward.points)}
          </span>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-tonki-accent py-2.5 text-sm font-bold text-tonki-accent-fg transition-colors hover:bg-tonki-accent-hover"
        >
          Reclamar
        </button>
      </div>
    </article>
  );
}

function SectionHeading({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-bold tracking-tight text-tonki-text">{title}</h2>
      <button
        type="button"
        className="text-sm font-semibold text-tonki-accent transition-colors hover:underline"
      >
        {action}
      </button>
    </div>
  );
}

function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
