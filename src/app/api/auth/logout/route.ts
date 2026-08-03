import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth/session";

// POST-only, deliberately: a GET handler here would clear the session as a
// side effect of a plain link visit, which Next.js's automatic <Link>
// prefetching (or a crawler/prefetcher) can trigger without any user intent
// -- exactly what silently logged users out just from the "Log out" item
// sitting in the same dropdown menu as other, harmless links.
export async function POST(req: NextRequest) {
  await clearSession();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url);
}
