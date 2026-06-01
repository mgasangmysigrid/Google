import { NextResponse } from "next/server";

import { sessionContext } from "@/lib/supabase/from-session";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { id } = await ctx.params;
  const { data, error } = await db
    .from("tasks")
    .update({ status: "closed" })
    .eq("id", id)
    .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
    .select()
    .maybeSingle();
  if (error) {
    console.error("tasks close error", error);
    return NextResponse.json({ error: "Failed to close task" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
