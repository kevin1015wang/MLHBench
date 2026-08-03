import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { guestId } = await params;
    const body = await request.json().catch(() => null);
    const quota = body?.ai_run_quota;

    if (typeof quota !== "number" || !Number.isInteger(quota) || quota < 0) {
      return NextResponse.json(
        { error: "ai_run_quota must be a non-negative integer" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();
    const { data: guest, error } = await supabase
      .from("guests")
      .update({ ai_run_quota: quota })
      .eq("id", guestId)
      .select()
      .single();

    if (error) {
      console.error("Error updating guest:", error);
      return NextResponse.json(
        { error: "Failed to update guest" },
        { status: 500 },
      );
    }

    return NextResponse.json({ guest });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
