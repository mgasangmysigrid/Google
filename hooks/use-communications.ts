"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import type { Task } from "@/types";

export type GmailThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: { name?: string; email: string }[];
  unread: boolean;
  latestDraftOrMessageDate: number;
  inbox_status?: "inbox" | "attached" | "ignored";
  task_id?: string | null;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  from: { name?: string; email: string }[];
  to: { name?: string; email: string }[];
  cc?: { name?: string; email: string }[];
  bcc?: { name?: string; email: string }[];
  date: number;
  unread: boolean;
};

export type EmailAttachment = {
  filename: string;
  contentType: string;
  content: string; // base64
  size?: number;
};

const KEY = ["communications"] as const;

type ListStatus = "inbox" | "attached" | "ignored";

export function useCommunications(status: ListStatus = "inbox") {
  return useQuery({
    queryKey: [...KEY, "list", status],
    queryFn: () =>
      api.get<{ items: GmailThread[]; connected: boolean }>(
        `/api/communications?status=${status}`,
      ),
  });
}

export function useThread(threadId: string | null) {
  return useQuery({
    queryKey: ["communications", "thread", threadId],
    enabled: !!threadId,
    queryFn: () =>
      api.get<{ thread: GmailThread; messages: GmailMessage[] }>(
        `/api/communications/threads/${encodeURIComponent(threadId as string)}`,
      ),
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      unread = false,
    }: {
      threadId: string;
      unread?: boolean;
    }) =>
      api.post(
        `/api/communications/threads/${encodeURIComponent(threadId)}/read`,
        { unread },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({
        queryKey: ["communications", "thread", vars.threadId],
      });
    },
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      to: { email: string; name?: string }[];
      subject: string;
      body: string;
      reply_to_message_id?: string;
      thread_id?: string;
      attachments?: EmailAttachment[];
    }) => api.post("/api/communications/email", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDisconnectGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<{ ok: true }>("/api/communications/google/revoke"),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAttachThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      task_id,
    }: {
      threadId: string;
      task_id: string;
    }) =>
      api.post(
        `/api/communications/threads/${encodeURIComponent(threadId)}/attach`,
        { task_id },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useIgnoreThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      api.post(
        `/api/communications/threads/${encodeURIComponent(threadId)}/ignore`,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateTaskFromThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      threadId,
      title,
      client_id,
    }: {
      threadId: string;
      title?: string;
      client_id?: string | null;
    }) =>
      api.post<{ task: Task; communication: unknown }>(
        `/api/communications/threads/${encodeURIComponent(threadId)}/new-task`,
        { title, client_id },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
