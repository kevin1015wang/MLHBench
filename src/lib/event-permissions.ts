import type { SessionUser } from "@/lib/auth/session";
import type { Event } from "@/lib/store";

// Client-side mirror of canManageEvent in src/lib/auth/event-access.ts,
// used only to decide which controls to show -- the API enforces it.
export function canManageEvent(
  user: SessionUser | null | undefined,
  event: Pick<Event, "owner_user_id">,
) {
  if (user?.role === "admin") return event.owner_user_id === null;
  if (user?.role === "user") return event.owner_user_id === user.userId;
  return false;
}

export function canCreateEvents(user: SessionUser | null | undefined) {
  return user?.role === "admin" || user?.role === "user";
}
