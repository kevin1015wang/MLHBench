import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/string-utils";

export async function GET(_req: Request) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Admins see every event; guests only see the ones they've been
    // granted. Two plain queries rather than an embedded Postgres join --
    // simpler and matches this codebase's existing query style.
    let eventIdFilter: string[] | null = null;
    if (session.user.role === "guest" && session.user.guestId) {
      const adminSupabase = createAdminClient();
      const { data: grants, error: grantsError } = await adminSupabase
        .from("guest_event_access")
        .select("event_id")
        .eq("guest_id", session.user.guestId);

      if (grantsError) {
        console.error("Error fetching guest event access:", grantsError);
        return NextResponse.json(
          { error: "Failed to fetch events" },
          { status: 500 },
        );
      }

      eventIdFilter = grants.map((grant) => grant.event_id);
      if (eventIdFilter.length === 0) {
        return NextResponse.json({ events: [] });
      }
    }

    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });
    if (eventIdFilter) {
      query = query.in("id", eventIdFilter);
    }

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
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

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

    const supabase = await createClient();

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
