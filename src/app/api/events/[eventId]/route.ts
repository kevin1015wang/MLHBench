import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { eventId } = await params;
    const body = await request.json().catch(() => null);

    const updates: Record<string, string | null> = {};

    if ("logo_url" in (body ?? {})) {
      const logoUrl =
        typeof body.logo_url === "string" ? body.logo_url.trim() : "";
      updates.logo_url = logoUrl || null;
    }

    if ("judging_ends_at" in (body ?? {})) {
      updates.judging_ends_at =
        typeof body.judging_ends_at === "string" && body.judging_ends_at
          ? body.judging_ends_at
          : null;
    }

    if ("starts_at" in (body ?? {})) {
      updates.starts_at =
        typeof body.starts_at === "string" && body.starts_at
          ? body.starts_at
          : null;
    }

    if ("ends_at" in (body ?? {})) {
      updates.ends_at =
        typeof body.ends_at === "string" && body.ends_at ? body.ends_at : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: event, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", eventId)
      .select()
      .single();

    if (error) {
      if (error.code === "23514") {
        return NextResponse.json(
          { error: "Start time must be before end time" },
          { status: 400 },
        );
      }
      console.error("Error updating event:", error);
      return NextResponse.json(
        { error: "Failed to update event" },
        { status: 500 },
      );
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { error: "eventId is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.from("events").delete().eq("id", eventId);

    if (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json(
        { error: "Failed to delete event" },
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
