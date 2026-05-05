import Image from "next/image";
import Link from "next/link";
import {
  AccountSlideOverGroup,
  AccountSlideOverTrigger,
} from "src/components/AccountSlideOver";

import { PostFeed } from "./PostFeed";

export default function DashboardPage() {
  return (
    <AccountSlideOverGroup>
      <div className="min-h-screen bg-tonki-canvas text-tonki-text">
        <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-tonki-border bg-tonki-canvas/90 px-5 py-4 backdrop-blur-md sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-3 text-tonki-text transition-colors hover:text-tonki-accent"
          >
            <Image src="/logo.png" alt="Tonki" width={36} height={36} />
            <span className="text-lg font-bold tracking-tight sm:text-xl">
              Tonki
            </span>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold sm:gap-6 sm:text-base">
            <span className="text-tonki-text">Tu feed</span>
            <AccountSlideOverTrigger className="min-w-0 max-w-[min(220px,calc(100vw-14rem))] truncate text-left font-medium text-tonki-text-muted transition-colors hover:text-tonki-text-secondary" />
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[600px] px-4 pb-24 pt-8 sm:px-6">
          <h1 className="sr-only">Publicaciones</h1>
          <PostFeed />
        </main>
      </div>
    </AccountSlideOverGroup>
  );
}
