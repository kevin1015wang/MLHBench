import { NextResponse } from "next/server";
import { getPrizeCategoryOwner } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/string-utils";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    // The admin hides a slug for everyone; a user only for themselves.
    const ownerUserId = getPrizeCategoryOwner(session);
    if (ownerUserId === undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const slug =
      typeof body?.slug === "string" && body.slug.trim()
        ? slugify(body.slug)
        : "";

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: ignoredSlug, error } = await supabase
      .from("ignored_prize_slugs")
      .insert({ slug, owner_user_id: ownerUserId })
      .select()
      .single();

    if (error) {
      console.error("Error ignoring prize slug:", error);
      const message =
        error.code === "23505"
          ? "This prize slug is already hidden."
          : "Failed to hide prize slug";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { ignored_prize_slug: ignoredSlug },
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
