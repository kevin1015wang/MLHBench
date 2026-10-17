"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/use-event-presence";
import { getAvatarColor } from "@/lib/avatar-color";

const MAX_VISIBLE = 5;

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

// The subset of PresenceUser the stack actually renders, so non-presence
// lists (e.g. who judged a project) can reuse it. `detail` is an optional
// second tooltip line.
type AvatarUser = Pick<PresenceUser, "userId" | "name" | "avatarUrl"> & {
  readonly role?: PresenceUser["role"] | string;
  readonly detail?: string;
};

interface PresenceAvatarsProps {
  readonly users: AvatarUser[];
  readonly size?: "sm" | "md";
}

export function PresenceAvatars({ users, size = "md" }: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = users.length - visible.length;
  const sizeClass = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  return (
    <TooltipProvider>
      <div className="flex -space-x-2">
        {visible.map((presenceUser) => (
          <Tooltip key={presenceUser.userId}>
            <TooltipTrigger asChild>
              <Avatar
                className={`${sizeClass} ring-2 ring-background cursor-default`}
              >
                {presenceUser.avatarUrl && (
                  <AvatarImage
                    src={presenceUser.avatarUrl}
                    alt={presenceUser.name}
                  />
                )}
                <AvatarFallback
                  style={{
                    backgroundColor: getAvatarColor(presenceUser.userId),
                  }}
                  className="font-semibold text-white"
                >
                  {getInitials(presenceUser.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {presenceUser.name}
                {presenceUser.role === "guest" ? " (Guest)" : ""}
              </p>
              {presenceUser.detail && (
                <p className="text-muted-foreground">{presenceUser.detail}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <Avatar className={`${sizeClass} ring-2 ring-background`}>
            <AvatarFallback className="bg-muted font-semibold">
              +{overflow}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}
