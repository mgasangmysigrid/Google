import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabase/server";

const Body = z.object({ task_id: z.string().uuid() });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { threadId } = await ctx.params;
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
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
