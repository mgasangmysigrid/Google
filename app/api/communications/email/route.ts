import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { supabaseServer } from "@/lib/supabase/server";
import {
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/google/client";
import { buildMime, encodeMime } from "@/lib/google/mime";

export const runtime = "nodejs";
export const maxDuration = 60;

const Attachment = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  content: z.string().min(1),
  size: z.number().int().nonnegative().optional(),
});

const SendEmail = z.object({
  to: z.array(z.object({ email: z.string().email(), name: z.string().optional() })).min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  reply_to_message_id: z.string().optional(),
  thread_id: z.string().optional(),
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
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = SendEmail.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();
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
    const message = err instanceof Error ? err.message : "Failed to send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
