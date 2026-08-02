import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/string-utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ prizeCategoryId: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prizeCategoryId } = await params;
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

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

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

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prizeCategoryId } = await params;

    const supabase = await createClient();

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
