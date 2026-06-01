import { NextResponse } from "next/server";

import { sessionContext } from "@/lib/supabase/from-session";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { db } = sc;

  const { id } = await ctx.params;
  const { data, error } = await db
    .from("clients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("clients GET error", error);
    return NextResponse.json({ error: "Failed to load client" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}
