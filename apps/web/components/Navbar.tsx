"use client";

import Link from "next/link";
import { LogOut, Sprout } from "lucide-react";
import { useLogout, useUser } from "@/lib/auth";
import { SearchBox } from "./SearchBox";
import { AlertsBell } from "./AlertsBell";

const links = [
  { href: "/", label: "Home" },
  { href: "/trading", label: "Trading" },
  { href: "/analytics", label: "Analytics" },
  { href: "/options", label: "Options" },
  { href: "/news", label: "News" },
  { href: "/watchlist", label: "Watchlist" },
];

function UserMenu() {
  const { data: user, isLoading } = useUser();
  const logout = useLogout();

  if (isLoading) return <span className="h-9 w-9 animate-pulse rounded-full bg-canvas" />;

  if (!user) {
    return (
      <Link
        href="/login"
        className="shrink-0 rounded-full bg-gradient-to-r from-accent to-accent-deep px-4 py-1.5 text-sm font-semibold text-white shadow-pop transition hover:opacity-90"
      >
        Log in
      </Link>
    );
  }

  const initial = (user.name ?? user.email)[0]?.toUpperCase() ?? "?";
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        title={user.email}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent-deep"
      >
        {initial}
      </span>
      <button
        onClick={() => logout.mutate()}
        title="Log out"
        className="rounded-full p-2 text-faint transition hover:bg-loss-soft hover:text-loss"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-deep text-white shadow-pop">
            <Sprout size={18} strokeWidth={2.5} />
          </span>
          <span className="text-lg font-bold tracking-tight">MadGrow</span>
        </Link>

        <div className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-soft transition hover:bg-accent-soft hover:text-accent-deep"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-3 md:flex-none">
          <SearchBox />
          <Link
            href="/portfolio"
            className="hidden shrink-0 rounded-full border border-line bg-card px-4 py-1.5 text-sm font-semibold shadow-card transition hover:border-accent hover:text-accent-deep sm:block"
          >
            Portfolio
          </Link>
          <AlertsBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
