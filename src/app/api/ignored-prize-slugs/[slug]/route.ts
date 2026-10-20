import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { slug } = await params;

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("ignored_prize_slugs")
      .delete()
      .eq("slug", slug);

    if (error) {
      console.error("Error unhiding prize slug:", error);
      return NextResponse.json(
        { error: "Failed to unhide prize slug" },
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
