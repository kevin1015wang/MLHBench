"use client";

import {
  Calendar,
  Folder,
  ImageOff,
  MapPin,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useSession } from "@/hooks/use-session";
import { type Event, useStore } from "@/lib/store";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EditEventDialog } from "./edit-event-dialog";
import { NewEventDialog } from "./new-event-dialog";

type EventStatus = {
  type: "upcoming" | "active" | "ended" | "unknown";
  label: string;
  daysUntil?: number;
};

function getEventStatus(
  startsAt: string | null,
  endsAt: string | null,
  judgingEndsAt: string | null,
): EventStatus {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Without a start/end range (the common case for new events, which only
  // collect a judging date), fall back to judging_ends_at to decide whether
  // the event belongs in the past or current section.
  if (!startsAt || !endsAt) {
    if (judgingEndsAt) {
      const judgingEnd = new Date(judgingEndsAt);
      judgingEnd.setHours(0, 0, 0, 0);
      if (now > judgingEnd) {
        return { type: "ended", label: "Ended" };
      }
      return { type: "active", label: "Active" };
    }
    return { type: "unknown", label: "" };
  }

  const start = new Date(startsAt);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endsAt);
  end.setHours(0, 0, 0, 0);

  // Event is active
  if (now >= start && now <= end) {
    return { type: "active", label: "Active" };
  }

  // Event has ended
  if (now > end) {
    return { type: "ended", label: "Ended" };
  }

  // Event is upcoming
  const diffTime = start.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { type: "upcoming", label: "Today", daysUntil: 0 };
  } else if (diffDays === 1) {
    return { type: "upcoming", label: "Tomorrow", daysUntil: 1 };
  }

  return {
    type: "upcoming",
    label: `In ${diffDays} days`,
    daysUntil: diffDays,
  };
}

// Prefers the start/end range when both are set; otherwise falls back to the
// single judging-end date, since new events typically only have that set.
function formatEventDateDisplay(event: Event): string | null {
  if (event.starts_at && event.ends_at) {
    const start = new Date(event.starts_at);
    const end = new Date(event.ends_at);
    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = start.getFullYear();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  }

  if (event.judging_ends_at) {
    return new Date(event.judging_ends_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return null;
}

function EventImage({
  logoUrl,
  eventName,
}: {
  readonly logoUrl: string | null;
  readonly eventName: string;
}) {
  const [imageError, setImageError] = useState(false);

  if (!logoUrl || imageError) {
    return (
      <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <ImageOff className="w-8 h-8 text-gray-400" />
      </div>
    );
  }

  return (
    <Image
      src={logoUrl}
      alt={eventName}
      width={64}
      height={64}
      className="w-16 h-16 rounded-lg object-cover bg-gray-100 shrink-0"
      onError={() => setImageError(true)}
    />
  );
}

export function EventsPage() {
  const { events, projects, setEvents, setProjects } = useStore();
  const { user } = useSession();
  const isAdmin = user?.role === "admin";
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewEventDialogOpen, setIsNewEventDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // Fetch events and related dashboard data
  useDashboardData(null);

  const getProjectCount = (eventId: string) => {
    return projects.filter((p) => p.event_id === eventId).length;
  };

  const handleEventDeleted = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId));
    setProjects(projects.filter((p) => p.event_id !== eventId));
  };

  const handleEventSaved = (updated: Event) => {
    setEvents(events.map((e) => (e.id === updated.id ? updated : e)));
  };

  const eventsWithStatus = events
    .filter((event) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return event.name.toLowerCase().includes(query);
    })
    .map((event) => ({
      event,
      status: getEventStatus(
        event.starts_at,
        event.ends_at,
        event.judging_ends_at,
      ),
    }));

  // Falls back to judging_ends_at when there's no start date, since most
  // events now only collect a judging date.
  const compareByDateAsc = (a: Event, b: Event) => {
    const aDate = a.starts_at ?? a.judging_ends_at;
    const bDate = b.starts_at ?? b.judging_ends_at;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  };

  const currentEvents = eventsWithStatus
    .filter(({ status }) => status.type !== "ended")
    .sort((a, b) => compareByDateAsc(a.event, b.event));

  const pastEvents = eventsWithStatus
    .filter(({ status }) => status.type === "ended")
    .sort((a, b) => compareByDateAsc(a.event, b.event));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Hackathon Events
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and review hackathon projects
          </p>
        </div>

        {isAdmin && (
          <div className="shrink-0 flex gap-2">
            <Button onClick={() => setIsNewEventDialogOpen(true)}>
              New Event
            </Button>
          </div>
        )}
      </div>

      {isAdmin && (
        <NewEventDialog
          open={isNewEventDialogOpen}
          onOpenChange={setIsNewEventDialogOpen}
        />
      )}

      <DeleteEventDialog
        event={eventToDelete}
        projectCount={eventToDelete ? getProjectCount(eventToDelete.id) : 0}
        onOpenChange={(open) => {
          if (!open) setEventToDelete(null);
        }}
        onDeleted={handleEventDeleted}
      />

      <EditEventDialog
        event={editingEvent}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null);
        }}
        onSaved={handleEventSaved}
      />

      <div className="flex gap-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {currentEvents.map(({ event, status }) => {
          const projectCount = getProjectCount(event.id);
          const href = `/events/${event.id}`;
          const isLive = status.type === "active";
          return (
            <Link key={event.id} href={href} className="block">
              <Card
                className={`cursor-pointer hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-0 outline-none overflow-hidden ${
                  isLive
                    ? "relative border border-green-500/40 hover:border-green-500/60 shadow-[0_0_0_1px_rgba(34,197,94,0.18),0_0_18px_rgba(34,197,94,0.18)] before:absolute before:inset-0 before:rounded-xl before:ring-4 before:ring-green-500/15 before:blur before:animate-pulse before:pointer-events-none"
                    : "hover:border-primary"
                }`}
              >
                <div className="flex gap-3 p-4">
                  <div className="self-center shrink-0">
                    <EventImage
                      logoUrl={event.logo_url}
                      eventName={event.name}
                    />
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <CardTitle
                          className="text-lg leading-tight truncate"
                          title={event.name}
                        >
                          {event.name}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {status.label &&
                          (() => {
                            const badgeVariant =
                              status.type === "active" ||
                              status.type === "upcoming"
                                ? "default"
                                : "secondary";
                            let badgeClassName = "shrink-0";
                            if (status.type === "active") {
                              badgeClassName =
                                "bg-green-500 text-white shrink-0";
                            } else if (status.type === "upcoming") {
                              badgeClassName =
                                "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 shrink-0";
                            }
                            return (
                              <Badge
                                variant={badgeVariant}
                                className={badgeClassName}
                              >
                                {status.label}
                              </Badge>
                            );
                          })()}
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingEvent(event);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEventToDelete(event);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {formatEventDateDisplay(event) && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">
                          {formatEventDateDisplay(event)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                      {event.city || event.state || event.country ? (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {[event.city, event.state, event.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1 invisible">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="truncate">—</span>
                        </div>
                      )}

                      {projectCount > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                <Folder className="w-4 h-4 shrink-0" />
                                <span className="font-medium">
                                  {projectCount}
                                </span>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Projects</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="inline-flex items-center gap-1 invisible">
                          <Folder className="w-4 h-4 shrink-0" />
                          <span className="font-medium">0</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {pastEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 py-8">
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
              Past events
            </div>
            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastEvents.map(({ event, status }) => {
              const projectCount = getProjectCount(event.id);
              const href = `/events/${event.id}`;
              const isEnded = status.type === "ended";

              return (
                <Link key={event.id} href={href} className="block">
                  <Card
                    className={`cursor-pointer hover:shadow-lg transition-all hover:border-primary focus-visible:outline-none focus-visible:ring-0 outline-none overflow-hidden ${
                      isEnded ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex gap-3 p-4">
                      <div className="self-center shrink-0">
                        <EventImage
                          logoUrl={event.logo_url}
                          eventName={event.name}
                        />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <CardTitle
                              className="text-lg leading-tight truncate"
                              title={event.name}
                            >
                              {event.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant="secondary" className="shrink-0">
                              {status.label}
                            </Badge>
                            {isAdmin && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEditingEvent(event);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-400 hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setEventToDelete(event);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {formatEventDateDisplay(event) && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">
                              {formatEventDateDisplay(event)}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
                          {event.city || event.state || event.country ? (
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="truncate">
                                {[event.city, event.state, event.country]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0 flex-1 invisible">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="truncate">—</span>
                            </div>
                          )}

                          {projectCount > 0 ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                    <Folder className="w-4 h-4 shrink-0" />
                                    <span className="font-medium">
                                      {projectCount}
                                    </span>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>Projects</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="inline-flex items-center gap-1 invisible">
                              <Folder className="w-4 h-4 shrink-0" />
                              <span className="font-medium">0</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {currentEvents.length === 0 && pastEvents.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No events found matching your criteria
          </p>
        </div>
      )}
    </div>
  );
}
