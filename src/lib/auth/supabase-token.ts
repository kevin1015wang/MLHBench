import { createHmac } from "node:crypto";
import type { SessionData } from "@/lib/auth/session";

// The browser's Supabase client authenticates as the signed-in Bench user
// via a short-lived JWT minted here from the bench_session cookie, instead
// of the bare publishable key. Every RLS policy (see supabase/schema.sql)
// keys off these claims, so each user's browser can only read and write
// the events they have access to -- including over Realtime.
//
// Signed HS256 with the project's legacy JWT secret (Supabase dashboard ->
// Project Settings -> JWT Keys -> Legacy JWT Secret), which Supabase keeps
// accepting for verification alongside the newer asymmetric signing keys as
// long as it isn't revoked.
const TOKEN_TTL_SECONDS = 60 * 60;

const getJwtSecret = () => {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      "SUPABASE_JWT_SECRET is required to mint browser Supabase tokens",
    );
  }
  return secret;
};

const base64url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url");

export function mintSupabaseToken(session: SessionData) {
  const { user } = session;
  const now = Math.floor(Date.now() / 1000);
  // Never outlive the app session itself.
  const exp = Math.min(
    now + TOKEN_TTL_SECONDS,
    Math.floor(session.expiresAt / 1000),
  );

  const appUid =
    user.role === "user"
      ? user.userId
      : user.role === "guest"
        ? user.guestId
        : undefined;

  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      aud: "authenticated",
      role: "authenticated",
      sub: appUid ?? user.id,
      iat: now,
      exp,
      app_role: user.role,
      app_uid: appUid,
      app_judge_id: user.id,
      // The admin has no users row, so invites to its events are matched by
      // email instead (is_event_member() in supabase/schema.sql).
      email: user.role === "admin" ? user.email?.toLowerCase() : undefined,
    }),
  );
  const signature = createHmac("sha256", getJwtSecret())
    .update(`${header}.${payload}`)
    .digest("base64url");

  return { token: `${header}.${payload}.${signature}`, expiresAt: exp * 1000 };
}
