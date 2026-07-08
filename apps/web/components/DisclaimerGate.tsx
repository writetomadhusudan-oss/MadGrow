"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { EDUCATION_DISCLAIMER } from "@market-cap/shared";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";

/**
 * Blocking modal shown once per account: users must accept the statutory
 * education disclaimer before using the app while signed in.
 */
export function DisclaimerGate() {
  const { data: user } = useUser();
  const qc = useQueryClient();
  const accept = useMutation({
    mutationFn: () => api("/auth/accept-disclaimer", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  if (!user || (user as { disclaimerAcceptedAt?: string | null }).disclaimerAcceptedAt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-card bg-card p-7 shadow-pop">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-deep">
          <ShieldAlert size={22} />
        </span>
        <h2 className="mt-4 text-xl font-bold">Before you start</h2>
        <p className="mt-3 rounded-2xl bg-canvas/60 p-4 text-sm leading-relaxed text-soft">
          {EDUCATION_DISCLAIMER}
        </p>
        <button
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
          className="mt-5 w-full rounded-full bg-gradient-to-r from-accent to-accent-deep py-3 text-sm font-bold text-white shadow-pop transition hover:opacity-90 disabled:opacity-60"
        >
          {accept.isPending ? "Saving…" : "I understand — practice only, no real money"}
        </button>
      </div>
    </div>
  );
}

export function DisclaimerText({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[11px] leading-snug text-faint ${className}`}>{EDUCATION_DISCLAIMER}</p>
  );
}
