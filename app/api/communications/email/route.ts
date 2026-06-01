import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";
import {
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/google/client";
import { buildMime, encodeMime } from "@/lib/google/mime";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Gmail's hard message cap is ~35 MB after base64 (~25 MB raw). We bound each
// field well below that so a single request cannot exhaust memory during JSON
// parse / base64 decode / MIME build (authenticated-DoS, CASA ASVS V13.2).
const MAX_BODY_CHARS = 500_000; // ~500 KB of HTML body
const MAX_SUBJECT_CHARS = 998; // RFC 5322 line-length guidance
const MAX_ATTACHMENT_B64 = 14_000_000; // ~10 MB per attachment after base64
const MAX_TOTAL_REQUEST_BYTES = 30 * 1024 * 1024; // overall request cap (~30 MB)
const noCtrl = /^[^\r\n]+$/; // reject CR/LF in header-bound fields

const Attachment = z.object({
  filename: z.string().min(1).max(255).regex(noCtrl),
  contentType: z.string().min(1).max(255).regex(/^[\w.+-]+\/[\w.+-]+$/),
  content: z.string().min(1).max(MAX_ATTACHMENT_B64),
  size: z.number().int().nonnegative().optional(),
});

const SendEmail = z.object({
  to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1).max(100),
  subject: z.string().min(1).max(MAX_SUBJECT_CHARS).regex(noCtrl),
  body: z.string().min(1).max(MAX_BODY_CHARS),
  reply_to_message_id: z.string().max(512).optional(),
  thread_id: z.string().max(512).optional(),
  attachments: z.array(Attachment).max(10).optional(),
});

function buildFooter(userId: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    "https://app.mysigrid.com";
  // Stable opaque token so the unsubscribe link doesn't leak the Google sub.
  const token = crypto.createHash("sha256").update(userId).digest("hex").slice(0, 16);
  return `\n<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px"/>\n<p style="font-size:12px;color:#6b7280;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">Sent via MySigrid. <a href="${baseUrl}/unsubscribe?u=${token}" style="color:#6b7280;text-decoration:underline">Unsubscribe</a></p>`;
}

export async function POST(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db: supabase } = ctx;

  // Anti-automation: cap outbound sends per user to prevent Gmail quota/cost
  // abuse and spam relay (CASA ASVS V11.1).
  const rl = rateLimit(`email-send:${userId}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many emails sent. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } },
    );
  }

  // Reject oversized requests up front (Next.js App Router has no default body
  // cap) so we never buffer a huge payload into memory.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_TOTAL_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const parsed = SendEmail.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: user } = await supabase
    .from("users")
    .select("email, first_name, last_name")
    .eq("id", userId)
    .single();
  if (!user?.email) {
    return NextResponse.json({ error: "user not found" }, { status: 400 });
  }

  let gmail;
  try {
    gmail = await getGmailClient(userId);
  } catch (err) {
    if (err instanceof GmailNotConnectedError) {
      return NextResponse.json(
        { error: "Gmail not connected. Sign in again." },
        { status: 400 },
      );
    }
    throw err;
  }

  const fromName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  const bodyWithFooter = parsed.data.body + buildFooter(userId);

  // If replying, look up the original Message-Id header so we can set
  // In-Reply-To/References and Gmail can thread the reply correctly.
  let inReplyTo: string | undefined;
  let references: string[] | undefined;
  let resolvedThreadId = parsed.data.thread_id;

  if (parsed.data.reply_to_message_id) {
    try {
      const orig = await gmail.users.messages.get({
        userId: "me",
        id: parsed.data.reply_to_message_id,
        format: "metadata",
        metadataHeaders: ["Message-Id", "References"],
      });
      const headers = orig.data.payload?.headers ?? [];
      const msgIdHeader = headers.find(
        (h) => h.name?.toLowerCase() === "message-id",
      )?.value;
      const refsHeader = headers.find(
        (h) => h.name?.toLowerCase() === "references",
      )?.value;
      if (msgIdHeader) {
        inReplyTo = msgIdHeader;
        references = [refsHeader, msgIdHeader].filter(Boolean) as string[];
      }
      if (!resolvedThreadId && orig.data.threadId) {
        resolvedThreadId = orig.data.threadId;
      }
    } catch (err) {
      console.warn("failed to fetch original message headers", err);
    }
  }

  const mime = buildMime({
    from: { name: fromName || undefined, email: user.email },
    to: parsed.data.to,
    subject: parsed.data.subject,
    htmlBody: bodyWithFooter,
    inReplyTo,
    references,
    attachments: parsed.data.attachments,
  });

  try {
    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodeMime(mime),
        ...(resolvedThreadId ? { threadId: resolvedThreadId } : {}),
      },
    });

    const sentMessage = sent.data;
    await supabase.from("communications").insert({
      owner_id: userId,
      gmail_thread_id: sentMessage.threadId ?? null,
      gmail_message_id: sentMessage.id ?? null,
      channel: "email",
      direction: "outbound",
      subject: parsed.data.subject,
      snippet: sentMessage.snippet ?? parsed.data.body.slice(0, 200),
      from_email: user.email,
      to_emails: parsed.data.to.map((t) => t.email),
      sent_by: userId,
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json(sentMessage, { status: 201 });
  } catch (err) {
    console.error("email send error", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
