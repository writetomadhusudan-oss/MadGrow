"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "@/lib/auth";
import type { AlertRow } from "@/lib/trading";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

export function AlertsBell() {
  const { data: user } = useUser();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const { data: alerts } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api<AlertRow[]>("/trading/alerts"),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Browser notifications for newly arrived unread alerts.
  useEffect(() => {
    if (!alerts) return;
    for (const alert of alerts.filter((a) => !a.read)) {
      if (seenIds.current.has(alert.id)) continue;
      seenIds.current.add(alert.id);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("MadGrow (paper trading)", { body: alert.message });
      }
    }
  }, [alerts]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = useMutation({
    mutationFn: () => api("/trading/alerts/read", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  if (!user) return null;
  const unread = alerts?.filter((a) => !a.read).length ?? 0;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) markRead.mutate();
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            Notification.requestPermission();
          }
        }}
        className="relative rounded-full p-2 text-soft transition hover:bg-accent-soft hover:text-accent-deep"
        title="Trade alerts"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-line bg-card shadow-pop">
          <p className="border-b border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-faint">
            Alerts
          </p>
          <div className="max-h-96 overflow-y-auto">
            {!alerts || alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-soft">No alerts yet.</p>
            ) : (
              alerts.map((a) => (
                <div key={a.id} className="border-b border-line/60 px-4 py-2.5 last:border-0">
                  <p className="text-sm leading-snug">{a.message}</p>
                  <p className="mt-0.5 text-[11px] text-faint">
                    {a.type.replaceAll("_", " ").toLowerCase()} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
