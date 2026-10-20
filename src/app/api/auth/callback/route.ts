import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildRedirectUri,
  consumeState,
  setSession,
  toSessionData,
} from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const buildErrorRedirect = (req: NextRequest, code: string) => {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", code);
  return NextResponse.redirect(url);
};

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const providerError = searchParams.get("error");

  if (providerError) return buildErrorRedirect(req, providerError);
  if (!code) return buildErrorRedirect(req, "missing_code");
  if (!(await consumeState(state)))
    return buildErrorRedirect(req, "state_mismatch");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: buildRedirectUri(),
    }).toString(),
  });

  if (!tokenResponse.ok)
    return buildErrorRedirect(req, "token_exchange_failed");

  const tokenJson = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokenJson.access_token)
    return buildErrorRedirect(req, "no_access_token");

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    },
  );

  if (!profileResponse.ok)
    return buildErrorRedirect(req, "profile_fetch_failed");

  const profile = (await profileResponse.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
  };

  const allowedEmail =
    process.env.ALLOWED_LOGIN_EMAIL?.trim().toLowerCase() ||
    "kevin1015wang@gmail.com";
  const normalizedEmail = profile.email?.trim().toLowerCase();

  if (!normalizedEmail) {
    return buildErrorRedirect(req, "profile_fetch_failed");
  }

  // Self-signup accounts are keyed to (and invites are claimed by) the
  // email address, so it has to be one Google has actually verified.
  if (profile.email_verified !== true) {
    return buildErrorRedirect(req, "email_not_verified");
  }

  const [fallbackFirstName, ...fallbackLastNameParts] = (profile.name || "")
    .split(" ")
    .filter(Boolean);
  const firstName = profile.given_name || fallbackFirstName || "User";
  const lastName = profile.family_name || fallbackLastNameParts.join(" ") || "";

  if (normalizedEmail === allowedEmail) {
    await setSession(
      toSessionData({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        user: {
          id: profile.sub,
          firstName,
          lastName,
          email: profile.email,
          avatarUrl: profile.picture || null,
          role: "admin",
        },
      }),
    );
  } else {
    const user = await upsertSelfSignupUser({
      googleSub: profile.sub,
      email: normalizedEmail,
      firstName,
      lastName,
      avatarUrl: profile.picture || null,
    });
    if (!user) return buildErrorRedirect(req, "account_setup_failed");

    await setSession(
      toSessionData({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        user: {
          id: user.id,
          firstName,
          lastName,
          email: normalizedEmail,
          avatarUrl: profile.picture || null,
          role: "user",
          userId: user.id,
          hasOpenRouterKey: !!user.openrouter_key_encrypted,
        },
      }),
    );
  }

  const redirectUrl = new URL("/events", req.url);
  return NextResponse.redirect(redirectUrl);
}

// Creates the users row on first sign-in (refreshing profile details on
// later ones), then claims any co-judge invites already sent to this email.
async function upsertSelfSignupUser(profile: {
  googleSub: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: user, error } = await supabase
    .from("users")
    .upsert(
      {
        google_sub: profile.googleSub,
        email: profile.email,
        first_name: profile.firstName,
        last_name: profile.lastName,
        avatar_url: profile.avatarUrl,
        last_login_at: now,
        updated_at: now,
      },
      { onConflict: "google_sub" },
    )
    .select("id, openrouter_key_encrypted")
    .single();

  if (error || !user) {
    console.error("Failed to upsert self-signup user:", error);
    return null;
  }

  const { error: claimError } = await supabase
    .from("event_members")
    .update({ user_id: user.id })
    .eq("email", profile.email)
    .is("user_id", null);
  if (claimError) {
    console.error("Failed to claim pending event invites:", claimError);
  }

  return user;
}
