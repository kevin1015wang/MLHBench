import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string | null;
  // "admin" is Kevin, gated by ALLOWED_LOGIN_EMAIL via Google OAuth.
  // "guest" is an email/password account the admin creates from the
  // guest-management page, scoped to whichever events they've granted via
  // guest_event_access.
  role: "admin" | "guest";
  guestId?: string;
}

export interface SessionData {
  user: SessionUser;
  // Only set for Google-authenticated (admin) sessions; guests have no
  // OAuth token. Already unused elsewhere in the app after login regardless.
  accessToken?: string;
  refreshToken?: string;
  expiresAt: number;
}

const SESSION_COOKIE = "bench_session";
const STATE_COOKIE = "google_oauth_state";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

const getSecret = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for session signing");
  }
  return secret;
};

const signPayload = (payload: string) => {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
};

const encodeSession = (session: SessionData) => {
  const payload = JSON.stringify(session);
  const signature = signPayload(payload);
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  return `${encodedPayload}.${signature}`;
};

const decodeSession = (value: string): SessionData | null => {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) return null;

  const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const expectedSignature = signPayload(payload);
  if (expectedSignature !== signature) return null;

  const parsed = JSON.parse(payload) as SessionData;
  if (Date.now() > parsed.expiresAt) return null;
  return parsed;
};

export const getSession = async () => {
  const cookieStore = await Promise.resolve(cookies());
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return decodeSession(raw);
};

export const setSession = async (session: SessionData) => {
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.set(SESSION_COOKIE, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
};

export const clearSession = async () => {
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
};

export const createState = async () => {
  const state = randomBytes(16).toString("hex");
  const cookieStore = await Promise.resolve(cookies());
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300, // 5 minutes
  });
  return state;
};

export const consumeState = async (incoming?: string | null) => {
  const cookieStore = await Promise.resolve(cookies());
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  if (!incoming || !storedState) return false;
  return storedState === incoming;
};

export const buildRedirectUri = () => {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`;
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL;
  if (vercelUrl) {
    const normalized = vercelUrl.startsWith("http")
      ? vercelUrl
      : `https://${vercelUrl}`;
    return `${normalized}/api/auth/callback`;
  }

  return "http://localhost:3000/api/auth/callback";
};

export const toSessionData = ({
  access_token,
  refresh_token,
  user,
}: {
  access_token?: string;
  refresh_token?: string;
  user: SessionUser;
}): SessionData => ({
  accessToken: access_token,
  refreshToken: refresh_token,
  user,
  // The app session's own TTL, not Google's access-token expiry: the access
  // token is only used once, right after login, to fetch the profile, so
  // there's no reason the app session should die when it does.
  expiresAt: Date.now() + SESSION_TTL_MS,
});

// Password hashing for guest accounts, via Node's built-in scrypt -- no new
// dependency, matching this file's existing dependency-free crypto style
// (HMAC session signing above). A per-password random salt means two
// identical passwords never produce the same hash.
const SCRYPT_KEY_LENGTH = 64;

export const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return { hash, salt };
};

export const verifyPassword = (
  password: string,
  hash: string,
  salt: string,
) => {
  const candidate = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
};

// Excludes visually-confusable characters (0/O, 1/l/I) since this is meant
// to be read off a screen and typed or shared out of band, not pasted.
const GUEST_PASSWORD_ALPHABET =
  "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

// Generates the one-time password for a guest account the admin creates.
// It's only ever returned once, in the creation response -- only the hash
// is persisted.
export const generateGuestPassword = (length = 12) => {
  const bytes = randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password +=
      GUEST_PASSWORD_ALPHABET[bytes[i] % GUEST_PASSWORD_ALPHABET.length];
  }
  return password;
};
