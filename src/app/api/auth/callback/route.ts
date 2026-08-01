import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  buildRedirectUri,
  consumeState,
  setSession,
  toSessionData,
} from "@/lib/auth/session";

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

  if (!normalizedEmail || normalizedEmail !== allowedEmail) {
    return buildErrorRedirect(req, "unauthorized_email");
  }

  if (profile.email_verified === false) {
    return buildErrorRedirect(req, "email_not_verified");
  }

  const [fallbackFirstName, ...fallbackLastNameParts] = (profile.name || "")
    .split(" ")
    .filter(Boolean);

  await setSession(
    toSessionData({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_in: tokenJson.expires_in ?? 3600,
      user: {
        id: profile.sub,
        firstName: profile.given_name || fallbackFirstName || "User",
        lastName: profile.family_name || fallbackLastNameParts.join(" ") || "",
        email: profile.email,
        avatarUrl: profile.picture || null,
      },
    }),
  );

  const redirectUrl = new URL("/events", req.url);
  return NextResponse.redirect(redirectUrl);
}
