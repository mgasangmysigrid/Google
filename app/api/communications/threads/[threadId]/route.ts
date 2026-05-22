import { NextResponse } from "next/server";
import type { gmail_v1 } from "googleapis";

import { auth } from "@/auth";
import {
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/google/client";

export const runtime = "nodejs";

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
) {
  if (!headers) return undefined;
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    undefined;
}

function parseAddressList(raw?: string) {
  if (!raw) return [];
  // Naive split on commas not inside quotes — sufficient for the demo.
  return raw
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^\s*(?:"?([^"<]*?)"?\s)?<?([^<>\s]+@[^<>\s]+)>?\s*$/);
      if (!match) return { email: part };
      return { name: match[1]?.trim() || undefined, email: match[2].trim() };
    });
}

function decodePart(data?: string | null) {
  if (!data) return "";
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf-8",
  );
}

function extractBody(payload?: gmail_v1.Schema$MessagePart): {
  html: string | null;
  text: string | null;
} {
  if (!payload) return { html: null, text: null };

  // Walk all parts looking for the best HTML body; fall back to text/plain.
  let html: string | null = null;
  let text: string | null = null;

  function walk(part: gmail_v1.Schema$MessagePart) {
    const mime = part.mimeType ?? "";
    if (mime === "text/html" && part.body?.data && !html) {
      html = decodePart(part.body.data);
    } else if (mime === "text/plain" && part.body?.data && !text) {
      text = decodePart(part.body.data);
    }
    for (const child of part.parts ?? []) walk(child);
  }

  walk(payload);
  return { html, text };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { threadId } = await ctx.params;
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

  let gmail;
  try {
    gmail = await getGmailClient(userId);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json({ error: "not_connected" }, { status: 400 });
    }
    throw err;
  }

  try {
    const resp = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    const gmailMessages = resp.data.messages ?? [];

    const messages = gmailMessages.map((m) => {
      const headers = m.payload?.headers;
      const fromList = parseAddressList(getHeader(headers, "From"));
      const toList = parseAddressList(getHeader(headers, "To"));
      const ccList = parseAddressList(getHeader(headers, "Cc"));
      const bccList = parseAddressList(getHeader(headers, "Bcc"));
      const subject = getHeader(headers, "Subject") ?? null;
      const dateMs = m.internalDate ? Number(m.internalDate) : Date.now();
      const { html, text } = extractBody(m.payload);
      return {
        id: m.id ?? "",
        threadId: m.threadId ?? threadId,
        subject,
        snippet: m.snippet ?? null,
        body: html ?? text ?? null,
        from: fromList,
        to: toList,
        cc: ccList,
        bcc: bccList,
        date: Math.floor(dateMs / 1000),
        unread: (m.labelIds ?? []).includes("UNREAD"),
      };
    });

    const last = gmailMessages[gmailMessages.length - 1];
    const lastHeaders = last?.payload?.headers;
    const subject = getHeader(lastHeaders, "Subject") ?? null;
    const participants = Array.from(
      new Map(
        messages
          .flatMap((m) => [...m.from, ...m.to])
          .map((p) => [p.email.toLowerCase(), p]),
      ).values(),
    );

    return NextResponse.json({
      thread: {
        id: threadId,
        subject,
        snippet: resp.data.snippet ?? null,
        participants,
        unread: messages.some((m) => m.unread),
        latestDraftOrMessageDate: messages[messages.length - 1]?.date ?? 0,
      },
      messages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gmail error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
