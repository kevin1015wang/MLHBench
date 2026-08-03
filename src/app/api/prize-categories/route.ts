import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/string-utils";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const shortName =
      typeof body?.short_name === "string" ? body.short_name.trim() : "";
    const systemPrompt =
      typeof body?.system_prompt === "string" ? body.system_prompt.trim() : "";
    const slug =
      typeof body?.slug === "string" && body.slug.trim()
        ? slugify(body.slug)
        : slugify(name);
    const findWords = Array.isArray(body?.find_words)
      ? body.find_words
          .filter((w: unknown): w is string => typeof w === "string")
          .map((w: string) => w.trim().toLowerCase())
          .filter(Boolean)
      : [];
    const aliasSlugs = Array.isArray(body?.alias_slugs)
      ? Array.from(
          new Set(
            body.alias_slugs
              .filter((w: unknown): w is string => typeof w === "string")
              .map((w: string) => slugify(w))
              .filter(Boolean),
          ),
        )
      : [];

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }
    if (!systemPrompt) {
      return NextResponse.json(
        { error: "system_prompt is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data: prizeCategory, error } = await supabase
      .from("prize_categories")
      .insert({
        name,
        short_name: shortName,
        slug,
        system_prompt: systemPrompt,
        find_words: findWords,
        alias_slugs: aliasSlugs,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating prize category:", error);
      const message =
        error.code === "23505"
          ? "A prize category with this name or slug already exists."
          : "Failed to create prize category";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { prize_category: prizeCategory },
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
