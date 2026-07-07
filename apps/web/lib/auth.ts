"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserInfo } from "@market-cap/shared";
import { api } from "./api";

export function useUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<UserInfo>("/auth/me");
      } catch {
        return null; // not signed in
      }
    },
    staleTime: 5 * 60_000,
    refetchInterval: false,
    retry: false,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      qc.setQueryData(["me"], null);
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });
}
