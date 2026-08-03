import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils/string-utils";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const slug =
      typeof body?.slug === "string" && body.slug.trim()
        ? slugify(body.slug)
        : "";

    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: ignoredSlug, error } = await supabase
      .from("ignored_prize_slugs")
      .insert({ slug })
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
