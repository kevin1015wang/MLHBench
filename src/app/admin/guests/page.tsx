import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GuestManagementPage } from "@/components/admin/guest-management-page";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Manage Guests | Bench",
};

export const dynamic = "force-dynamic";

export default async function AdminGuestsPage() {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    redirect("/events");
  }

  return (
    <AppShell>
      <GuestManagementPage />
    </AppShell>
  );
}
