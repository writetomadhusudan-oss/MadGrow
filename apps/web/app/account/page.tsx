"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useLogout, useUser } from "@/lib/auth";

export default function AccountPage() {
  const { data: user, isLoading } = useUser();
  const logout = useLogout();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");

  const remove = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
    onSuccess: () => {
      qc.clear();
      router.push("/");
    },
  });

  if (isLoading) return <div className="mx-auto h-64 max-w-xl animate-pulse rounded-card bg-card/70" />;

  if (!user) {
    return (
      <div className="mx-auto max-w-xl rounded-card bg-card p-10 text-center shadow-card">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <UserRound size={24} />
        </span>
        <h1 className="mt-4 text-xl font-bold">Your account</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-soft">
          Sign in to manage your MadGrow account, or to permanently delete it and all of its
          data.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block rounded-full bg-gradient-to-r from-accent to-accent-deep px-6 py-2.5 text-sm font-bold text-white shadow-pop"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-card bg-card p-6 shadow-card">
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <dl className="mt-4 space-y-2 text-sm">
          {user.name && (
            <div className="flex justify-between gap-4">
              <dt className="text-faint">Name</dt>
              <dd className="font-semibold">{user.name}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-faint">Email</dt>
            <dd className="truncate font-semibold">{user.email}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/") })}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent-deep"
          >
            Log out
          </button>
          <Link
            href="/privacy"
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold transition hover:border-accent hover:text-accent-deep"
          >
            Privacy policy
          </Link>
        </div>
      </div>

      <div className="rounded-card border border-loss/30 bg-card p-6 shadow-card">
        <h2 className="flex items-center gap-2 text-lg font-bold text-loss">
          <Trash2 size={18} /> Delete account
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-soft">
          This permanently deletes your account and everything attached to it — your MadCoins
          wallet, orders, positions, trade history, watchlist and alerts. It takes effect
          immediately and cannot be undone.
        </p>

        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="mt-4 rounded-full border border-loss/50 px-5 py-2 text-sm font-bold text-loss transition hover:bg-loss-soft"
          >
            Delete my account…
          </button>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              remove.mutate();
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-soft">
                Enter your password to confirm
              </span>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-line bg-canvas/50 px-4 py-2.5 text-base outline-none focus:border-loss sm:text-sm"
              />
            </label>
            {remove.isError && (
              <p className="rounded-2xl bg-loss-soft px-4 py-2.5 text-sm font-medium text-loss">
                {(remove.error as Error).message}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={remove.isPending || !password}
                className="rounded-full bg-loss px-5 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
              >
                {remove.isPending ? "Deleting…" : "Permanently delete"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setPassword("");
                  remove.reset();
                }}
                className="rounded-full border border-line px-5 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
