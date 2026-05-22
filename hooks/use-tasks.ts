"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import type { Task } from "@/types";

const KEY = ["tasks"] as const;

type Filters = {
  status?: string;
  client_id?: string;
  mine?: boolean;
};

function buildQuery(filters?: Filters) {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.client_id) params.set("client_id", filters.client_id);
  if (filters.mine === false) params.set("mine", "false");
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useTasks(filters?: Filters) {
  return useQuery({
    queryKey: [...KEY, filters ?? {}],
    queryFn: () =>
      api.get<{ items: Task[] }>(`/api/tasks${buildQuery(filters)}`),
    select: (d) => d.items,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => api.get<Task>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Task> & { title: string }) =>
      api.post<Task>("/api/tasks", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Task> }) =>
      api.put<Task>(`/api/tasks/${id}`, input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, vars.id] });
    },
  });
}

export function useCloseTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Task>(`/api/tasks/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/api/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
