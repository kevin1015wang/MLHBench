import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { Database } from "@/database.types";

// Every caller across data-service.ts, the store, and realtime used to get
// its own client, so a single page (e.g. /prize-categories, which fires off
// several fetches at once outside the shared DashboardRoot data layer) could
// spin up half a dozen GoTrueClient instances simultaneously -- each one
// touching localStorage in its constructor, which throws in Safari Private
// Browsing and is a likely culprit for mobile-only auth flakiness. Reuse one
// instance per browser tab instead.
let browserClient: SupabaseClient<Database> | undefined;

// Short-lived JWT minted by /api/auth/supabase-token from the bench_session
// cookie. RLS only lets it see the signed-in user's events -- the bare
// publishable key alone can't read anything.
let cachedToken: { token: string; expiresAt: number } | null = null;
let pendingToken: Promise<string | null> | null = null;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

async function getAccessToken(): Promise<string | null> {
  if (
    cachedToken &&
    cachedToken.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS
  ) {
    return cachedToken.token;
  }

  pendingToken ??= fetch("/api/auth/supabase-token", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) {
        cachedToken = null;
        return null;
      }
      cachedToken = (await response.json()) as {
        token: string;
        expiresAt: number;
      };
      return cachedToken.token;
    })
    .catch(() => null)
    .finally(() => {
      pendingToken = null;
    });

  return pendingToken;
}

// Call on logout so a different account signing in within the same tab
// never reuses the previous user's token.
export function clearSupabaseAccessToken() {
  cachedToken = null;
}

export function createClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient<Database>(
      // biome-ignore lint/style/noNonNullAssertion: it's safe here
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // biome-ignore lint/style/noNonNullAssertion: it's safe here
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { accessToken: getAccessToken },
    );
  }
  return browserClient;
}
