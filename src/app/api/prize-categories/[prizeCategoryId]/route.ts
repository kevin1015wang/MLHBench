import { NextResponse } from "next/server";
import { getPrizeCategoryOwner } from "@/lib/auth/require-role";
import { getSession, type SessionData } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/string-utils";

// Only the category's owner may edit or delete it: the admin for the
// global catalog, a user for their own. 404 for anything you can't own so
// other users' category ids don't leak.
async function requireCategoryOwner(
  session: SessionData | null,
  prizeCategoryId: string,
) {
  const ownerUserId = getPrizeCategoryOwner(session);
  if (ownerUserId === undefined) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const query = supabase
    .from("prize_categories")
    .select("id")
    .eq("id", prizeCategoryId);
  const { data, error } = await (ownerUserId
    ? query.eq("owner_user_id", ownerUserId)
    : query.is("owner_user_id", null)
  ).maybeSingle();

  if (error) {
    console.error("Error checking prize category ownership:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Prize category not found" },
      { status: 404 },
    );
  }
  return null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ prizeCategoryId: string }> },
) {
  try {
    const session = await getSession();
    const { prizeCategoryId } = await params;
    const ownerError = await requireCategoryOwner(session, prizeCategoryId);
    if (ownerError) return ownerError;
    const body = await request.json().catch(() => null);

    const updates: Record<string, unknown> = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { error: "name cannot be empty" },
          { status: 400 },
        );
      }
      updates.name = name;
    }
    if (typeof body?.short_name === "string") {
      updates.short_name = body.short_name.trim();
    }
    if (typeof body?.slug === "string") {
      const slug = slugify(body.slug);
      if (!slug) {
        return NextResponse.json(
          { error: "slug cannot be empty" },
          { status: 400 },
        );
      }
      updates.slug = slug;
    }
    if (typeof body?.system_prompt === "string") {
      const systemPrompt = body.system_prompt.trim();
      if (!systemPrompt) {
        return NextResponse.json(
          { error: "system_prompt cannot be empty" },
          { status: 400 },
        );
      }
      updates.system_prompt = systemPrompt;
    }
    if (Array.isArray(body?.find_words)) {
      updates.find_words = body.find_words
        .filter((w: unknown): w is string => typeof w === "string")
        .map((w: string) => w.trim().toLowerCase())
        .filter(Boolean);
    }
    if (Array.isArray(body?.alias_slugs)) {
      updates.alias_slugs = Array.from(
        new Set(
          body.alias_slugs
            .filter((w: unknown): w is string => typeof w === "string")
            .map((w: string) => slugify(w))
            .filter(Boolean),
        ),
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: prizeCategory, error } = await supabase
      .from("prize_categories")
      .update(updates)
      .eq("id", prizeCategoryId)
      .select()
      .single();

    if (error) {
      console.error("Error updating prize category:", error);
      const message =
        error.code === "23505"
          ? "A prize category with this name or slug already exists."
          : "Failed to update prize category";
      return NextResponse.json({ error: message }, { status: 400 });
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ prizeCategoryId: string }> },
) {
  try {
    const session = await getSession();
    const { prizeCategoryId } = await params;
    const ownerError = await requireCategoryOwner(session, prizeCategoryId);
    if (ownerError) return ownerError;

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("prize_categories")
      .delete()
      .eq("id", prizeCategoryId);

    if (error) {
      console.error("Error deleting prize category:", error);
      return NextResponse.json(
        { error: "Failed to delete prize category" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
