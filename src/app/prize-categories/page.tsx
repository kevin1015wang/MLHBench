"use client";

import { AppShell } from "@/components/app-shell";
import { PrizeCategoriesPage } from "@/components/prize-categories/prize-categories-page";

export default function Page() {
  return (
    <AppShell onProjectClick={() => {}}>
      <PrizeCategoriesPage />
    </AppShell>
  );
}
