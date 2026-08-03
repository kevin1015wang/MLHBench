import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/auth/session";

// Guards admin-only API routes (event/prize-category/guest management,
// etc.). Returns a 403 response to short-circuit the handler when the
// session isn't an admin; returns null when it's fine to proceed.
export function requireAdmin(session: SessionData | null) {
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
