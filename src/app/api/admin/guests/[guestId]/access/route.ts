import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { guestId } = await params;
    const body = await request.json().catch(() => null);
    const eventId =
      typeof body?.event_id === "string" ? body.event_id.trim() : "";

    if (!eventId) {
      return NextResponse.json(
        { error: "event_id is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("guest_event_access")
      .insert({ guest_id: guestId, event_id: eventId });

    // 23505 = unique violation -- already granted, treat as a no-op success.
    if (error && error.code !== "23505") {
      console.error("Error granting guest event access:", error);
      return NextResponse.json(
        { error: "Failed to grant access" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
