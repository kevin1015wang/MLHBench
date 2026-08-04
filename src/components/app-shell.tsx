"use client";

import type React from "react";

import { TopBar } from "@/components/navigation/topbar";
import type { PresenceUser } from "@/hooks/use-event-presence";
import type { Event, Project } from "@/lib/store";

interface AppShellProps {
  readonly children: React.ReactNode;
  readonly selectedEvent?: Event;
  readonly selectedProject?: Project | null;
  readonly presenceUsers?: PresenceUser[];
}

export function AppShell({
  children,
  selectedEvent,
  selectedProject,
  presenceUsers,
}: AppShellProps) {
  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopBar
        selectedEvent={selectedEvent}
        selectedProject={selectedProject}
        presenceUsers={presenceUsers}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
