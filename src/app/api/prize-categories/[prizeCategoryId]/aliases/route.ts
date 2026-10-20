import { NextResponse } from "next/server";
import { getPrizeCategoryOwner } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/string-utils";

// Attaches one more Devpost prize-name slug to a category, so a CSV whose
// prize is worded differently still matches it. Unlike PATCH, this is open
// to any signed-up user on the global catalog -- not just the admin -- so
// users can map their hackathon's wording onto the built-in MLH tracks.
// It's append-only by design: users can't rename a global category, touch
// its prompt, or remove aliases the admin's own events rely on.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ prizeCategoryId: string }> },
) {
  try {
    const session = await getSession();
    const callerOwnerId = getPrizeCategoryOwner(session);
    if (callerOwnerId === undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { prizeCategoryId } = await params;
    const body = await request.json().catch(() => null);
    const slug =
      typeof body?.slug === "string" && body.slug.trim()
        ? slugify(body.slug)
        : "";
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: category, error: fetchError } = await supabase
      .from("prize_categories")
      .select("id, slug, alias_slugs, owner_user_id")
      .eq("id", prizeCategoryId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error loading prize category:", fetchError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    // Global categories are open to everyone; private ones only to their
    // owner. 404 rather than 403 so other users' category ids don't leak.
    const canAddAlias =
      category &&
      (category.owner_user_id === null ||
        category.owner_user_id === callerOwnerId);
    if (!category || !canAddAlias) {
      return NextResponse.json(
        { error: "Prize category not found" },
        { status: 404 },
      );
    }

    if (slug === category.slug || category.alias_slugs.includes(slug)) {
      const { data: unchanged } = await supabase
        .from("prize_categories")
        .select()
        .eq("id", prizeCategoryId)
        .single();
      return NextResponse.json({ prize_category: unchanged });
    }

    const { data: prizeCategory, error } = await supabase
      .from("prize_categories")
      .update({
        alias_slugs: [...category.alias_slugs, slug],
        updated_at: new Date().toISOString(),
      })
      .eq("id", prizeCategoryId)
      .select()
      .single();

    if (error) {
      console.error("Error adding prize category alias:", error);
      return NextResponse.json(
        { error: "Failed to add alias" },
        { status: 500 },
      );
    }

    return NextResponse.json({ prize_category: prizeCategory });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
