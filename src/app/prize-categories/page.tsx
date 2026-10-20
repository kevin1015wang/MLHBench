"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PrizeCategoriesPage } from "@/components/prize-categories/prize-categories-page";
import { useSession } from "@/hooks/use-session";

export default function Page() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  // The admin curates the global catalog; self-signup users manage their
  // own private categories alongside it. Guests can't edit either.
  const canManageCategories = user?.role === "admin" || user?.role === "user";

  useEffect(() => {
    if (!isLoading && !canManageCategories) {
      router.replace("/events");
    }
  }, [isLoading, canManageCategories, router]);

  if (isLoading || !canManageCategories) {
    return null;
  }

  return (
    <AppShell>
      <PrizeCategoriesPage />
    </AppShell>
  );
}
