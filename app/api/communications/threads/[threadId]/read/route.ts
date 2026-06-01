import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  GmailNotConnectedError,
  getGmailClient,
} from "@/lib/google/client";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { threadId } = await ctx.params;
  if (!threadId) {
    return NextResponse.json({ error: "threadId required" }, { status: 400 });
  }

  let unread = false;
  try {
    const body = (await req.json()) as { unread?: boolean } | null;
    if (body && typeof body.unread === "boolean") unread = body.unread;
  } catch {
    // empty body is fine — defaults to marking read
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
    const resp = await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: unread
        ? { addLabelIds: ["UNREAD"] }
        : { removeLabelIds: ["UNREAD"] },
    });
    return NextResponse.json(resp.data);
  } catch (err) {
    console.error("thread read-state error", err);
    return NextResponse.json({ error: "Gmail error" }, { status: 500 });
  }
}
