import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { setSession, toSessionData, verifyPassword } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const buildErrorRedirect = (req: NextRequest, code: string) => {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status: 303 });
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return buildErrorRedirect(req, "invalid_credentials");
    }

    const supabase = createAdminClient();
    const { data: guest, error } = await supabase
      .from("guests")
      .select()
      .eq("email", email)
      .maybeSingle();

    if (error || !guest) {
      return buildErrorRedirect(req, "invalid_credentials");
    }

    const isValid = verifyPassword(
      password,
      guest.password_hash,
      guest.password_salt,
    );
    if (!isValid) {
      return buildErrorRedirect(req, "invalid_credentials");
    }

    await setSession(
      toSessionData({
        user: {
          id: guest.id,
          firstName: guest.display_name || guest.email,
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
    console.error("Unexpected error during guest login:", error);
    return buildErrorRedirect(req, "invalid_credentials");
  }
}
