import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const supabase = createAdminClient();

    const { data: guests, error } = await supabase
      .from("guests")
      .select(
        "id, username, display_name, ai_run_quota, ai_run_count, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching guests:", error);
      return NextResponse.json(
        { error: "Failed to fetch guests" },
        { status: 500 },
      );
    }

    const { data: grants, error: grantsError } = await supabase
      .from("guest_event_access")
      .select("guest_id, event_id");

    if (grantsError) {
      console.error("Error fetching guest event access:", grantsError);
      return NextResponse.json(
        { error: "Failed to fetch guests" },
        { status: 500 },
      );
    }

    const eventIdsByGuest = new Map<string, string[]>();
    for (const grant of grants ?? []) {
      const list = eventIdsByGuest.get(grant.guest_id) ?? [];
      list.push(grant.event_id);
      eventIdsByGuest.set(grant.guest_id, list);
    }

    const result = (guests ?? []).map((guest) => ({
      ...guest,
      event_ids: eventIdsByGuest.get(guest.id) ?? [],
    }));

    return NextResponse.json({ guests: result });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
