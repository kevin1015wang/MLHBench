import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ guestId: string; eventId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { guestId, eventId } = await params;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("guest_event_access")
      .delete()
      .eq("guest_id", guestId)
      .eq("event_id", eventId);

    if (error) {
      console.error("Error revoking guest event access:", error);
      return NextResponse.json(
        { error: "Failed to revoke access" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
