import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/database.types";

// Service-role client: bypasses RLS entirely, unlike client.ts/server.ts
// (both anon-key based). Used exclusively for the guests/guest_event_access
// tables, which are deliberately locked out of the anon role -- see
// supabase/schema.sql. Never import this from a "use client" component; the
// service-role key must never reach the browser.
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() must never be called from the browser -- it holds the Supabase service-role key.",
    );
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for guest auth");
  }

  return createSupabaseClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: it's safe here
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
