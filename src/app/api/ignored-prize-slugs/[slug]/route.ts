import { NextResponse } from "next/server";
import { getPrizeCategoryOwner } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await getSession();
    // Each caller can only unhide what they hid: the admin the global list,
    // a user their own.
    const ownerUserId = getPrizeCategoryOwner(session);
    if (ownerUserId === undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { slug } = await params;

    const supabase = createAdminClient();

    const query = supabase
      .from("ignored_prize_slugs")
      .delete()
      .eq("slug", slug);
    const { error } = await (ownerUserId
      ? query.eq("owner_user_id", ownerUserId)
      : query.is("owner_user_id", null));

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
