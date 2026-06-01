import { NextResponse } from "next/server";

import { sessionContext } from "@/lib/supabase/from-session";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { threadId } = await ctx.params;
  const { data, error } = await db
    .from("communications")
    .upsert(
      {
        owner_id: userId,
        gmail_thread_id: threadId,
        channel: "email",
        inbox_status: "ignored",
      },
      { onConflict: "owner_id,gmail_thread_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("ignore error", error);
    return NextResponse.json({ error: "Failed to ignore thread" }, { status: 500 });
  }
  return NextResponse.json(data);
}
