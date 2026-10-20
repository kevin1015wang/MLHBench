import { NextResponse } from "next/server";
import { getAccessibleEventIds } from "@/lib/auth/event-access";
import { requireOnboarded } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/string-utils";

export async function GET(_req: Request) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const onboardingError = requireOnboarded(session);
    if (onboardingError) return onboardingError;

    const supabase = createAdminClient();

    let eventIds: string[];
    try {
      eventIds = await getAccessibleEventIds(session);
    } catch (accessError) {
      console.error("Error resolving accessible events:", accessError);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 },
      );
    }
    if (eventIds.length === 0) {
      return NextResponse.json({ events: [] });
    }

    const query = supabase
      .from("events")
      .select("*")
      .in("id", eventIds)
      .order("created_at", { ascending: false });

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching events:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 },
      );
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // The admin creates unowned (MLH) events; self-signup users own theirs.
    const role = session?.user.role;
    if (role !== "admin" && !(role === "user" && session?.user.userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const onboardingError = requireOnboarded(session);
    if (onboardingError) return onboardingError;
    const ownerUserId = role === "user" ? (session?.user.userId ?? null) : null;

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const startsAt =
      typeof body?.starts_at === "string" ? body.starts_at : null;
    const endsAt = typeof body?.ends_at === "string" ? body.ends_at : null;
    const logoUrl =
      typeof body?.logo_url === "string" ? body.logo_url.trim() : "";
    const judgingEndsAt =
      typeof body?.judging_ends_at === "string" ? body.judging_ends_at : null;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      return NextResponse.json(
        { error: "starts_at must be before ends_at" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const baseSlug = slugify(name) || "event";
    const { data: existingSlugs, error: slugError } = await supabase
      .from("events")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    if (slugError) {
      console.error("Error checking existing slugs:", slugError);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 },
      );
    }

    const takenSlugs = new Set((existingSlugs ?? []).map((row) => row.slug));
    let slug = baseSlug;
    let suffix = 2;
    while (takenSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    const { data: event, error } = await supabase
      .from("events")
      .insert({
        name,
        slug,
        status: "active",
        starts_at: startsAt,
        ends_at: endsAt,
        logo_url: logoUrl || null,
        judging_ends_at: judgingEndsAt,
        owner_user_id: ownerUserId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json(
        { error: "Failed to create event" },
        { status: 500 },
      );
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
