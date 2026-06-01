import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";

const CreateTask = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  status: z
    .enum(["draft", "reminder", "active", "pending", "closed"])
    .default("active"),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  client_id: z.string().uuid().optional().nullable(),
  deadline: z.string().datetime().optional().nullable(),
  action_date: z.string().datetime().optional().nullable(),
  notification_at: z.string().datetime().optional().nullable(),
  est_effort_minutes: z.number().int().nonnegative().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
});

export async function GET(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = ctx;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const clientId = url.searchParams.get("client_id");

  // RLS already scopes tasks to the caller (assignee or creator); the explicit
  // .or() filter is kept as defense-in-depth so the intent is clear even if a
  // policy is ever loosened.
  let q = db
    .from("tasks")
    .select("*, client:clients(id, name)")
    .or(`assignee_id.eq.${userId},created_by.eq.${userId}`)
    .order("deadline", { ascending: true, nullsFirst: false });
  if (status) q = q.eq("status", status);
  if (clientId) q = q.eq("client_id", clientId);

  const { data, error } = await q;
  if (error) {
    console.error("tasks list error", error);
    return NextResponse.json({ error: "Failed to load tasks" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db } = ctx;

  const body = await req.json();
  const parsed = CreateTask.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const insert = {
    ...parsed.data,
    assignee_id: parsed.data.assignee_id ?? userId,
    created_by: userId,
  };

  const { data, error } = await db
    .from("tasks")
    .insert(insert)
    .select("*, client:clients(id, name)")
    .single();
  if (error) {
    console.error("tasks create error", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
