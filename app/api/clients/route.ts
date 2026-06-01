import { NextResponse } from "next/server";
import { z } from "zod";

import { sessionContext } from "@/lib/supabase/from-session";

const CreateClient = z.object({
  name: z.string().min(1),
  status: z.enum(["active", "inactive"]).default("active"),
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { db } = ctx;

  const url = new URL(req.url);
  const search = url.searchParams.get("q");
  const status = url.searchParams.get("status");

  let q = db.from("clients").select("*").order("name");
  if (status) q = q.eq("status", status);
  if (search) q = q.ilike("name", `%${search}%`);

  const { data, error } = await q;
  if (error) {
    console.error("clients list error", error);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await sessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { db } = ctx;

  const body = await req.json();
  const parsed = CreateClient.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await db
    .from("clients")
    .insert(parsed.data)
    .select()
    .single();
  if (error) {
    console.error("clients create error", error);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
