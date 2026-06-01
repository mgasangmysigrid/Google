import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";

const UpdateTask = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z
    .enum(["draft", "reminder", "active", "pending", "closed"])
    .optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  client_id: z.string().uuid().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  action_date: z.string().datetime().nullable().optional(),
  notification_at: z.string().datetime().nullable().optional(),
  est_effort_minutes: z.number().int().nonnegative().nullable().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
});

// Defense-in-depth ownership filter on top of RLS (assignee or creator).
function ownedBy(userId: string) {
  return `assignee_id.eq.${userId},created_by.eq.${userId}`;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { id } = await ctx.params;
  const { data, error } = await db
    .from("tasks")
    .select("*, client:clients(id, name)")
    .eq("id", id)
    .or(ownedBy(userId))
    .maybeSingle();
  if (error) {
    console.error("tasks GET error", error);
    return NextResponse.json({ error: "Failed to load task" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = UpdateTask.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { data, error } = await db
    .from("tasks")
    .update(parsed.data)
    .eq("id", id)
    .or(ownedBy(userId))
    .select("*, client:clients(id, name)")
    .maybeSingle();
  if (error) {
    console.error("tasks PUT error", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = sc;

  const { id } = await ctx.params;
  const { error } = await db
    .from("tasks")
    .delete()
    .eq("id", id)
    .or(ownedBy(userId));
  if (error) {
    console.error("tasks DELETE error", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
