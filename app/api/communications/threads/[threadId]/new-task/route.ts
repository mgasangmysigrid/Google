import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";

const Body = z.object({
  title: z.string().min(1).optional(),
  client_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ threadId: string }> },
) {
  const sc = await sessionContext();
  if (!sc) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, db: supabase } = sc;

  const { threadId } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Pull the persisted thread row so we can default the task title from the subject.
  const { data: comm } = await supabase
    .from("communications")
    .select("subject, snippet, client_id")
    .eq("owner_id", userId)
    .eq("gmail_thread_id", threadId)
    .maybeSingle();

  const title =
    parsed.data.title?.trim() ||
    comm?.subject?.trim() ||
    "(email) follow-up";

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title,
      description: comm?.snippet ?? null,
      status: "active",
      priority: parsed.data.priority ?? "normal",
      assignee_id: userId,
      created_by: userId,
      client_id: parsed.data.client_id ?? comm?.client_id ?? null,
    })
    .select("*, client:clients(id, name)")
    .single();

  if (taskError) {
    console.error("new-task create error", taskError);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  const { data: communication, error: commError } = await supabase
    .from("communications")
    .upsert(
      {
        owner_id: userId,
        gmail_thread_id: threadId,
        channel: "email",
        inbox_status: "attached",
        task_id: task.id,
      },
      { onConflict: "owner_id,gmail_thread_id" },
    )
    .select("*")
    .single();

  if (commError) {
    console.error("new-task link error", commError);
    return NextResponse.json(
      { error: "Failed to link email to task" },
      { status: 500 },
    );
  }

  return NextResponse.json({ task, communication }, { status: 201 });
}
