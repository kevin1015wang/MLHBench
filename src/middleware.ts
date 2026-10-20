import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/callback",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/guest-login",
];

const isPublicPath = (pathname: string) => {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
};

type SessionPayload = {
  expiresAt?: number;
  user?: { role?: string; hasOpenRouterKey?: boolean };
};

// Decodes the session payload for routing only. The signature isn't checked
// here (no node:crypto on the edge), so this never grants access by itself
// -- every API route re-verifies the cookie via getSession().
const readSession = (value: string): SessionPayload | null => {
  const [encodedPayload] = value.split(".");
  if (!encodedPayload) return null;

  const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  try {
    const payload = JSON.parse(atob(padded)) as SessionPayload;
    if (payload.expiresAt && Date.now() >= payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
};

// Self-signup users have to add an OpenRouter key before anything else.
const ONBOARDING_PATH = "/settings";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/logo")
  ) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get("bench_session")?.value;
  const session = sessionCookie ? readSession(sessionCookie) : null;
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    session.user?.role === "user" &&
    !session.user.hasOpenRouterKey &&
    pathname !== ONBOARDING_PATH
  ) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)",
  ],
};
