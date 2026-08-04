"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { createClient } from "@/lib/supabase/client";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  role: "admin" | "guest";
  projectId: string | null;
}

// Tracks who else is on the same event page via a Supabase Realtime
// Presence channel (ephemeral "who's connected" state -- distinct from the
// Postgres-changes subscription in use-realtime-subscription.ts, which
// syncs table rows, not connected users).
export function useEventPresence(
  eventId: string | null,
  projectId: string | null,
): PresenceUser[] {
  const { user } = useSession();
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const projectIdRef = useRef(projectId);

  // Re-broadcast which project we're looking at without tearing down the
  // channel (that would flicker everyone else's view of us offline).
  useEffect(() => {
    projectIdRef.current = projectId;
    if (channelRef.current && user) {
      void channelRef.current.track({
        userId: user.id,
        name: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
        projectId,
      } satisfies PresenceUser);
    }
  }, [projectId, user]);

  useEffect(() => {
    if (!eventId || !user) {
      setUsers([]);
      return;
    }

    const supabase = createClient();
    const channel = supabase.channel(`event-presence-${eventId}`, {
      config: { presence: { key: user.id } },
    });

    const syncState = () => {
      const state = channel.presenceState<PresenceUser>();
      setUsers(
        Object.values(state)
          .map((entries) => entries[0])
          .filter((entry): entry is PresenceUser & { presence_ref: string } =>
            Boolean(entry),
          ),
      );
    };

    channel.on("presence", { event: "sync" }, syncState).subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({
          userId: user.id,
          name: `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`.trim(),
          avatarUrl: user.avatarUrl ?? null,
          role: user.role,
          projectId: projectIdRef.current,
        } satisfies PresenceUser);
      }
    });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [eventId, user]);

  return users;
}
