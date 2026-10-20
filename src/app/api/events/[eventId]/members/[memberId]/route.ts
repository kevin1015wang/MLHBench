import { NextResponse } from "next/server";
import { requireEventManager } from "@/lib/auth/event-access";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; memberId: string }> },
) {
  try {
    const session = await getSession();
    const { eventId, memberId } = await params;
    const accessError = await requireEventManager(session, eventId);
    if (accessError) return accessError;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("id", memberId)
      .eq("event_id", eventId);

    if (error) {
      console.error("Error removing event member:", error);
      return NextResponse.json(
        { error: "Failed to remove judge" },
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
