import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hashPassword, setSession, toSessionData } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

const buildErrorRedirect = (req: NextRequest, code: string) => {
  const url = new URL("/signup", req.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status: 303 });
};

// Self-service guest signup: anyone can create an account (no invite code),
// but a fresh account has zero event access and zero AI run quota until the
// admin grants both via the guest-management page, so an unvetted signup is
// inert by default -- see the security notes in supabase/schema.sql.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const displayName = String(formData.get("display_name") ?? "").trim();

    if (!USERNAME_PATTERN.test(username)) {
      return buildErrorRedirect(req, "invalid_username");
    }
    if (password.length < 8) {
      return buildErrorRedirect(req, "weak_password");
    }

    const supabase = createAdminClient();
    const { hash, salt } = hashPassword(password);

    const { data: guest, error } = await supabase
      .from("guests")
      .insert({
        username,
        password_hash: hash,
        password_salt: salt,
        display_name: displayName || username,
      })
      .select()
      .single();

    if (error) {
      const code = error.code === "23505" ? "username_taken" : "signup_failed";
      return buildErrorRedirect(req, code);
    }

    await setSession(
      toSessionData({
        user: {
          id: guest.id,
          firstName: guest.display_name || guest.username,
          lastName: "",
          role: "guest",
          guestId: guest.id,
        },
      }),
    );

    return NextResponse.redirect(new URL("/events", req.url), {
      status: 303,
    });
  } catch (error) {
    console.error("Unexpected error during guest signup:", error);
    return buildErrorRedirect(req, "signup_failed");
  }
}
