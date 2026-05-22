"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import type { Client } from "@/types";

const KEY = ["clients"] as const;

export function useClients(query?: string) {
  return useQuery({
    queryKey: [...KEY, { q: query ?? "" }],
    queryFn: () =>
      api.get<{ items: Client[] }>(
        `/api/clients${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      ),
    select: (d) => d.items,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Client> & { name: string }) =>
      api.post<Client>("/api/clients", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
