import { NextResponse } from "next/server";
import { auth } from "@/auth";

import { supabaseServer } from "@/lib/supabase/server";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { threadId } = await ctx.params;
  const supabase = supabaseServer();
  const { data, error } = await supabase
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
