import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { revokeGoogleAccess } from "@/lib/google/client";

export const runtime = "nodejs";

export async function DELETE() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await revokeGoogleAccess(userId);
  } catch (err) {
    console.error("google disconnect failed", err);
    return NextResponse.json(
      { error: "Failed to fully disconnect Google. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
