import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";

const Body = z.object({ task_id: z.string().uuid() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { threadId } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await db
    .from("communications")
    .upsert(
      {
        owner_id: userId,
        gmail_thread_id: threadId,
        channel: "email",
        inbox_status: "attached",
        task_id: parsed.data.task_id,
      },
      { onConflict: "owner_id,gmail_thread_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.error("attach error", error);
    return NextResponse.json({ error: "Failed to attach email" }, { status: 500 });
  }
  return NextResponse.json(data);
}
