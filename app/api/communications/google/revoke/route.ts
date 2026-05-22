import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { revokeGoogleAccess } from "@/lib/google/client";

export const runtime = "nodejs";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await revokeGoogleAccess(userId);
  return NextResponse.json({ ok: true });
}
