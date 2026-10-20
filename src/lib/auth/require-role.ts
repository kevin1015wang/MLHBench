import { NextResponse } from "next/server";
import type { SessionData } from "@/lib/auth/session";

// Guards admin-only API routes (event/prize-category/guest management,
// etc.). Returns a 403 response to short-circuit the handler when the
// session isn't an admin; returns null when it's fine to proceed.
export function requireAdmin(session: SessionData | null) {
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// Self-signup users can't do anything until they've saved an OpenRouter
// key (see SessionUser.hasOpenRouterKey). Returns a response to
// short-circuit the handler, or null to proceed.
export function requireOnboarded(session: SessionData | null) {
  if (session?.user?.role === "user" && !session.user.hasOpenRouterKey) {
    return NextResponse.json(
      {
        error: "Add your OpenRouter API key in Settings to use Bench.",
        code: "openrouter_key_required",
      },
      { status: 403 },
    );
  }
  return null;
}

// Who a newly created prize category belongs to: the admin curates the
// global catalog (owner null), self-signup users keep private ones.
// Returns undefined when the session can't own categories at all.
export function getPrizeCategoryOwner(
  session: SessionData | null,
): string | null | undefined {
  if (session?.user?.role === "admin") return null;
  if (
    session?.user?.role === "user" &&
    session.user.userId &&
    session.user.hasOpenRouterKey
  ) {
    return session.user.userId;
  }
  return undefined;
}
