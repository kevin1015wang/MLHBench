import { NextResponse } from "next/server";
import { requireOnboarded } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { mintSupabaseToken } from "@/lib/auth/supabase-token";

// Polled by the browser Supabase client (src/lib/supabase/client.ts) for
// the JWT it sends on every REST and Realtime request.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const onboardingError = requireOnboarded(session);
  if (onboardingError) return onboardingError;

  return NextResponse.json(mintSupabaseToken(session), {
    headers: { "Cache-Control": "no-store" },
  });
}
