"use client";

import type React from "react";
import { useState } from "react";

import { Sidebar } from "@/components/navigation/sidebar";
import { TopBar } from "@/components/navigation/topbar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Event, Project } from "@/lib/store";

interface AppShellProps {
  readonly children: React.ReactNode;
  readonly selectedEvent?: Event;
  readonly selectedProject?: Project | null;
  readonly onProjectClick: (project: Project) => void;
}

export function AppShell({
  children,
  selectedEvent,
  selectedProject,
  onProjectClick,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden md:flex">
        <Sidebar onProjectClick={onProjectClick} />
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            className="w-full border-r-0"
            onProjectClick={(project) => {
              setMobileNavOpen(false);
              onProjectClick(project);
            }}
          />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          selectedEvent={selectedEvent}
          selectedProject={selectedProject}
          onMenuClick={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
