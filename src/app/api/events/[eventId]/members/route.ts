import { NextResponse } from "next/server";
import {
  getEventOwnership,
  requireEventManager,
} from "@/lib/auth/event-access";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Co-judges on a self-signup user's event. Invites are by email and work
// before the invitee has ever signed in: the row's user_id is filled in on
// their first Google login (see upsertSelfSignupUser in the auth callback).
// Admin-run events use guest accounts instead, so these routes only apply
// to user-owned events.

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function requireOwnedEvent(eventId: string) {
  const event = await getEventOwnership(eventId);
  if (!event?.owner_user_id) {
    return NextResponse.json(
      { error: "Judges can only be invited to your own events" },
      { status: 400 },
    );
  }
  return null;
}

async function listMembers(eventId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("id, email, user_id, created_at, user:users(first_name, last_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return data.map((member) => ({
    id: member.id,
    email: member.email,
    created_at: member.created_at,
    joined: !!member.user_id,
    name: member.user
      ? `${member.user.first_name} ${member.user.last_name}`.trim()
      : "",
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getSession();
    const { eventId } = await params;
    const accessError = await requireEventManager(session, eventId);
    if (accessError) return accessError;

    return NextResponse.json({ members: await listMembers(eventId) });
  } catch (error) {
    console.error("Error listing event members:", error);
    return NextResponse.json(
      { error: "Failed to load judges" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getSession();
    const { eventId } = await params;
    const accessError = await requireEventManager(session, eventId);
    if (accessError) return accessError;
    const ownedError = await requireOwnedEvent(eventId);
    if (ownedError) return ownedError;

    const body = await request.json().catch(() => null);
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    }
    if (email === session?.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "You already own this event" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const { error } = await supabase.from("event_members").insert({
      event_id: eventId,
      email,
      user_id: existingUser?.id ?? null,
    });

    if (error && error.code !== "23505") {
      console.error("Error inviting event member:", error);
      return NextResponse.json(
        { error: "Failed to invite judge" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { members: await listMembers(eventId) },
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
