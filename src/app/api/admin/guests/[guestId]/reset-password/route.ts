import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import {
  generateGuestPassword,
  getSession,
  hashPassword,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Generates a fresh password for a guest and immediately invalidates the
// old one (password_hash/salt are overwritten, not appended). Same
// one-time-reveal contract as account creation -- the plaintext password is
// only ever returned in this response.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ guestId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { guestId } = await params;

    const password = generateGuestPassword();
    const { hash, salt } = hashPassword(password);

    const supabase = createAdminClient();
    const { data: guest, error } = await supabase
      .from("guests")
      .update({ password_hash: hash, password_salt: salt })
      .eq("id", guestId)
      .select("id, email")
      .single();

    if (error) {
      console.error("Error resetting guest password:", error);
      return NextResponse.json(
        { error: "Failed to reset password" },
        { status: 500 },
      );
    }

    return NextResponse.json({ guest, password });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
