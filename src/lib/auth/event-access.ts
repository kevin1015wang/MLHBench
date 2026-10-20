import { NextResponse } from "next/server";
import { hasGuestEventAccess } from "@/lib/auth/guest-access";
import { requireOnboarded } from "@/lib/auth/require-role";
import type { SessionData } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side mirror of the can_access_event() RLS function in
// supabase/schema.sql. API routes use the service-role client, which
// bypasses RLS, so every route that touches an event has to check here.
//
//   admin -> events with no owner (the admin-run MLH events)
//   user  -> events they own, or were invited to via event_members
//   guest -> events granted via guest_event_access
//
// "Manage" (edit/delete the event, invite judges, remap its prize column)
// is narrower: the admin for unowned events, or the owning user.

type EventOwnership = { id: string; owner_user_id: string | null };

export async function getEventOwnership(
  eventId: string,
): Promise<EventOwnership | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("events")
    .select("id, owner_user_id")
    .eq("id", eventId)
    .maybeSingle();

  if (error) {
    console.error("Error loading event ownership:", error);
    return null;
  }
  return data;
}

async function isEventMember(userId: string, eventId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("event_members")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error checking event membership:", error);
    return false;
  }
  return !!data;
}

export function canManageEvent(
  session: SessionData | null,
  event: EventOwnership,
) {
  const user = session?.user;
  if (!user) return false;
  if (user.role === "admin") return event.owner_user_id === null;
  if (user.role === "user") return event.owner_user_id === user.userId;
  return false;
}

async function canAccessEvent(
  session: SessionData | null,
  event: EventOwnership,
) {
  const user = session?.user;
  if (!user) return false;
  if (canManageEvent(session, event)) return true;
  if (user.role === "user" && user.userId) {
    return isEventMember(user.userId, event.id);
  }
  if (user.role === "guest" && user.guestId) {
    return hasGuestEventAccess(user.guestId, event.id);
  }
  return false;
}

// Guards routes any judge on an event may use (add project, CSV import,
// start review, ...). Returns a response to short-circuit the handler, or
// null to proceed. 404 rather than 403 for events you can't see, so event
// ids don't leak across accounts.
export async function requireEventAccess(
  session: SessionData | null,
  eventId: string,
) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const onboardingError = requireOnboarded(session);
  if (onboardingError) return onboardingError;
  const event = await getEventOwnership(eventId);
  if (!event || !(await canAccessEvent(session, event))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  return null;
}

// Guards owner-only routes (edit/delete event, manage judges).
export async function requireEventManager(
  session: SessionData | null,
  eventId: string,
) {
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const onboardingError = requireOnboarded(session);
  if (onboardingError) return onboardingError;
  const event = await getEventOwnership(eventId);
  if (!event || !(await canAccessEvent(session, event))) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!canManageEvent(session, event)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// Event ids visible to this session, or null for "no filter needed".
// Mirrors canAccessEvent for list queries.
export async function getAccessibleEventFilter(session: SessionData) {
  const supabase = createAdminClient();
  const { user } = session;

  if (user.role === "admin") {
    return { ownerIsNull: true as const };
  }

  if (user.role === "guest" && user.guestId) {
    const { data, error } = await supabase
      .from("guest_event_access")
      .select("event_id")
      .eq("guest_id", user.guestId);
    if (error) throw error;
    return { eventIds: data.map((row) => row.event_id) };
  }

  if (user.role === "user" && user.userId) {
    const [owned, memberships] = await Promise.all([
      supabase.from("events").select("id").eq("owner_user_id", user.userId),
      supabase
        .from("event_members")
        .select("event_id")
        .eq("user_id", user.userId),
    ]);
    if (owned.error) throw owned.error;
    if (memberships.error) throw memberships.error;
    return {
      eventIds: Array.from(
        new Set([
          ...owned.data.map((row) => row.id),
          ...memberships.data.map((row) => row.event_id),
        ]),
      ),
    };
  }

  return { eventIds: [] };
}

// Prize categories an event's projects are matched and reviewed against:
// the admin's global catalog plus the event owner's private ones. When both
// define the same slug, the owner's wins.
export async function getPrizeCategoriesForOwner(ownerUserId: string | null) {
  const supabase = createAdminClient();
  const query = supabase.from("prize_categories").select("*");
  const { data, error } = await (ownerUserId
    ? query.or(`owner_user_id.is.null,owner_user_id.eq.${ownerUserId}`)
    : query.is("owner_user_id", null));
  if (error) throw error;
  return preferOwnerCategories(data);
}

function preferOwnerCategories<
  T extends { slug: string; owner_user_id: string | null },
>(categories: T[]): T[] {
  const bySlug = new Map<string, T>();
  for (const category of categories) {
    const existing = bySlug.get(category.slug);
    if (
      !existing ||
      (existing.owner_user_id === null && category.owner_user_id)
    ) {
      bySlug.set(category.slug, category);
    }
  }
  return Array.from(bySlug.values());
}
