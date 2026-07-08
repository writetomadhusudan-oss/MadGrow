"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sprout } from "lucide-react";
import { api } from "@/lib/api";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(
          mode === "register" ? { email, password, name: name || undefined } : { email, password }
        ),
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      router.push("/");
    },
  });

  const isLogin = mode === "login";

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-card bg-card shadow-pop md:grid-cols-2">
      {/* Gradient hero, echoing the reference "Invest Smarter, Not Harder" panel */}
      <div className="relative flex flex-col justify-end bg-gradient-to-b from-ink via-[#312a8f] to-accent p-8 text-white md:min-h-[480px]">
        <span className="absolute left-8 top-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
          <Sprout size={22} />
        </span>
        <h1 className="text-3xl font-bold leading-tight">
          Invest Smarter
          <span className="block text-xl font-medium text-white/80">Not Harder</span>
        </h1>
        <p className="mt-3 text-sm text-white/70">
          Track NSE &amp; BSE stocks with live pricing, news, and your personal
          portfolio — all in MadGrow.
        </p>
      </div>

      {/* Form */}
      <form
        className="flex flex-col justify-center gap-4 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <h2 className="text-xl font-bold">{isLogin ? "Welcome back" : "Create your account"}</h2>

        {!isLogin && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-soft">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-soft">Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
        </label>

        {mutation.isError && (
          <p className="rounded-2xl bg-loss-soft px-4 py-2.5 text-sm font-medium text-loss">
            {(mutation.error as Error).message}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-full bg-gradient-to-r from-accent to-accent-deep py-3 text-sm font-bold text-white shadow-pop transition hover:opacity-90 disabled:opacity-60"
        >
          {mutation.isPending ? "Please wait…" : isLogin ? "Log in" : "Register"}
        </button>

        <p className="rounded-2xl bg-canvas/60 p-3 text-[10px] leading-snug text-faint">
          This application is provided solely for educational and trading practice purposes using
          virtual currency (MadCoins). It does not facilitate trades involving real money or any
          regulated financial instruments. Signals and analytics are educational estimates, not
          financial advice.
        </p>

        <p className="text-center text-sm text-soft">
          {isLogin ? (
            <>
              New to MadGrow?{" "}
              <Link href="/register" className="font-semibold text-accent-deep hover:underline">
                Register
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-accent-deep hover:underline">
                Log in
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
