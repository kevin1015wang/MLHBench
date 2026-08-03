import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import {
  generateGuestPassword,
  getSession,
  hashPassword,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// The admin creates guest accounts directly (no self-service signup): give
// it an email, get back a generated password to share out of band. The
// password is only ever returned here, in this response -- only its hash
// is persisted. A fresh account has zero event access and zero AI run
// quota until granted via PATCH/access routes below.
export async function POST(request: Request) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const body = await request.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName =
      typeof body?.display_name === "string" ? body.display_name.trim() : "";

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "A valid email is required" },
        { status: 400 },
      );
    }

    const password = generateGuestPassword();
    const { hash, salt } = hashPassword(password);

    const supabase = createAdminClient();
    const { data: guest, error } = await supabase
      .from("guests")
      .insert({
        email,
        password_hash: hash,
        password_salt: salt,
        display_name: displayName || email.split("@")[0],
      })
      .select("id, email, display_name, ai_run_quota, ai_run_count, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "That email already has an account" },
          { status: 409 },
        );
      }
      console.error("Error creating guest:", error);
      return NextResponse.json(
        { error: "Failed to create guest" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { guest: { ...guest, event_ids: [] }, password },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const supabase = createAdminClient();

    const { data: guests, error } = await supabase
      .from("guests")
      .select("id, email, display_name, ai_run_quota, ai_run_count, created_at")
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
