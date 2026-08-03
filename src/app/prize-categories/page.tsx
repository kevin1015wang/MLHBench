"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PrizeCategoriesPage } from "@/components/prize-categories/prize-categories-page";
import { useSession } from "@/hooks/use-session";

export default function Page() {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace("/events");
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading || !isAdmin) {
    return null;
  }

  return (
    <AppShell>
      <PrizeCategoriesPage />
    </AppShell>
  );
}
