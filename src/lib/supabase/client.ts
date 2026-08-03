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

export function createClient() {
  if (!browserClient) {
    browserClient = createSupabaseClient<Database>(
      // biome-ignore lint/style/noNonNullAssertion: it's safe here
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      // biome-ignore lint/style/noNonNullAssertion: it's safe here
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return browserClient;
}
