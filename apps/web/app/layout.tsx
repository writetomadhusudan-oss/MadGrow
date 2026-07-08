import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { DisclaimerGate } from "@/components/DisclaimerGate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MadGrow — Invest Smarter, Not Harder",
  description:
    "Track NSE & BSE stocks with live pricing, market news, and your personal portfolio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          <Navbar />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pb-12">
            {children}
          </main>
          <BottomNav />
          <DisclaimerGate />
          <footer className="mx-auto max-w-6xl px-6 pb-24 pt-2 text-center text-xs text-faint md:pb-8">
            Prices are delayed ~15 minutes · Data via Yahoo Finance · Educational paper trading
            with virtual MadCoins only · <Link href="/about" className="underline">Disclaimer</Link>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
