import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function hasGuestEventAccess(
  guestId: string,
  eventId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("guest_event_access")
    .select("id")
    .eq("guest_id", guestId)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Error checking guest event access:", error);
    return false;
  }
  return !!data;
}

// Atomically charges one AI run against a guest's quota via the
// charge_guest_ai_run() Postgres function (see supabase/schema.sql) -- a
// single conditional `UPDATE ... WHERE ai_run_count < ai_run_quota` done
// server-side, not a read-then-write from here, so Postgres row-locks the
// guest's row and concurrent requests near the quota boundary serialize
// correctly instead of racing past it. Returns true if the run was charged
// (quota available), false if the guest is out of runs.
export async function chargeGuestAiRun(guestId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("charge_guest_ai_run", {
    p_guest_id: guestId,
  });

  if (error) {
    console.error("Error charging guest AI run:", error);
    return false;
  }
  return data === true;
}

// Guards routes guests are allowed to use (add project, CSV import, start
// review), scoped to whichever event the action targets. Admins always
// pass; guests only pass for events they've been granted; anyone else is
// rejected. Returns a response to short-circuit the handler, or null to
// proceed.
export async function requireEventAccess(
  session: SessionData | null,
  eventId: string,
) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "admin") {
    return null;
  }
  if (session.user.role === "guest" && session.user.guestId) {
    const allowed = await hasGuestEventAccess(session.user.guestId, eventId);
    if (allowed) return null;
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
