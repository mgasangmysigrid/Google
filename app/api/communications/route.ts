import { NextResponse } from "next/server";

import { sessionContext } from "@/lib/supabase/from-session";
import {
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/google/client";

export const runtime = "nodejs";

type ThreadView = {
  id: string;
  subject: string | null;
  snippet: string | null;
  participants: { name?: string; email: string }[];
  unread: boolean;
  latestDraftOrMessageDate: number;
  inbox_status: string;
  task_id: string | null;
};

function getHeader(
  headers: { name?: string | null; value?: string | null }[] | undefined,
  name: string,
) {
  if (!headers) return undefined;
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? undefined;
}

function parseAddress(raw?: string): { name?: string; email: string } | null {
  if (!raw) return null;
  const match = raw.match(/^\s*(?:"?([^"<]*?)"?\s)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
  if (!match) return null;
  const name = match[1]?.trim();
  return { name: name || undefined, email: match[2].trim() };
}

function threadFromRow(row: {
  gmail_thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  from_email: string | null;
  from_name: string | null;
  received_at: string;
  inbox_status: string;
  task_id: string | null;
}): ThreadView {
  const participants = row.from_email
    ? [{ name: row.from_name ?? undefined, email: row.from_email }]
    : [];
  return {
    id: row.gmail_thread_id ?? "",
    subject: row.subject,
    snippet: row.snippet,
    participants,
    unread: false,
    latestDraftOrMessageDate: row.received_at
      ? Math.floor(new Date(row.received_at).getTime() / 1000)
      : 0,
    inbox_status: row.inbox_status,
    task_id: row.task_id,
  };
}

export async function GET(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db: supabase } = ctx;

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "25"), 50);
  const status = (url.searchParams.get("status") ?? "inbox") as
    | "inbox"
    | "attached"
    | "ignored";

  if (status === "attached" || status === "ignored") {
    const { data: rows, error } = await supabase
      .from("communications")
      .select(
        "gmail_thread_id, subject, snippet, from_email, from_name, received_at, inbox_status, task_id",
      )
      .eq("owner_id", userId)
      .eq("inbox_status", status)
      .order("received_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("communications list error", error);
      return NextResponse.json(
        { error: "Failed to load communications" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      items: (rows ?? []).filter((r) => r.gmail_thread_id).map(threadFromRow),
      connected: true,
    });
  }

  let gmail;
  try {
    gmail = await getGmailClient(userId);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json({ items: [], connected: false });
    }
    throw err;
  }

  try {
    const listResp = await gmail.users.threads.list({
      userId: "me",
      maxResults: limit,
      labelIds: ["INBOX"],
    });
    const ids = (listResp.data.threads ?? [])
      .map((t) => t.id)
      .filter((id): id is string => !!id);

    // Fetch metadata (snippet, headers, labels) for each thread in parallel.
    const threads = await Promise.all(
      ids.map(async (id) => {
        const t = await gmail.users.threads.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });
        const messages = t.data.messages ?? [];
        const last = messages[messages.length - 1];
        const headers = last?.payload?.headers ?? [];
        const fromRaw = getHeader(headers, "From");
        const sender = parseAddress(fromRaw);
        const subject = getHeader(headers, "Subject") ?? null;
        const dateMs = last?.internalDate ? Number(last.internalDate) : Date.now();
        const isUnread = (last?.labelIds ?? []).includes("UNREAD");
        return {
          id,
          subject,
          snippet: t.data.snippet ?? null,
          sender,
          dateMs,
          unread: isUnread,
        };
      }),
    );

    // Upsert metadata into communications for tabs + history; preserve existing status.
    if (threads.length > 0) {
      const inserts = threads.map((t) => ({
        owner_id: userId,
        gmail_thread_id: t.id,
        channel: "email" as const,
        direction: "inbound" as const,
        subject: t.subject,
        snippet: t.snippet,
        from_email: t.sender?.email ?? null,
        from_name: t.sender?.name ?? null,
        received_at: new Date(t.dateMs).toISOString(),
      }));
      await supabase
        .from("communications")
        .upsert(inserts, { onConflict: "owner_id,gmail_thread_id" });
    }

    const { data: overrides } = await supabase
      .from("communications")
      .select("gmail_thread_id, inbox_status, task_id")
      .eq("owner_id", userId)
      .in("gmail_thread_id", threads.map((t) => t.id));
    const overrideMap = new Map(
      (overrides ?? []).map((o) => [
        o.gmail_thread_id as string,
        { inbox_status: o.inbox_status as string, task_id: o.task_id as string | null },
      ]),
    );

    const items: ThreadView[] = threads
      .map((t) => {
        const ov = overrideMap.get(t.id);
        return {
          id: t.id,
          subject: t.subject,
          snippet: t.snippet,
          participants: t.sender ? [t.sender] : [],
          unread: t.unread,
          latestDraftOrMessageDate: Math.floor(t.dateMs / 1000),
          inbox_status: ov?.inbox_status ?? "inbox",
          task_id: ov?.task_id ?? null,
        };
      })
      .filter((t) => t.inbox_status !== "ignored");

    return NextResponse.json({ items, connected: true });
  } catch (err) {
    // Log the real error server-side; return a generic message so upstream
    // Gmail/Supabase internals are not disclosed to the client.
    console.error("communications list error", err);
    return NextResponse.json(
      { error: "Failed to load messages", connected: true, items: [] },
      { status: 500 },
    );
  }
}
