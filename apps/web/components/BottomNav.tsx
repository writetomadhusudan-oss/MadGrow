"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, CandlestickChart, Home, Star, TrendingUp } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trading", label: "Trading", icon: CandlestickChart },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="flex items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-accent-deep" : "text-faint"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
