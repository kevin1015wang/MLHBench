import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SettingsPage } from "@/components/settings/settings-page";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Settings | Bench",
};

export const dynamic = "force-dynamic";

// Self-signup users only: the admin's AI runs use the server's own key and
// guests draw from a quota the admin sets. Also the onboarding step -- the
// middleware sends users here until they've saved an OpenRouter key.
export default async function Page() {
  const session = await getSession();

  if (session?.user.role !== "user") {
    redirect("/events");
  }

  return (
    <AppShell>
      <SettingsPage requiresKey={!session.user.hasOpenRouterKey} />
    </AppShell>
  );
}
