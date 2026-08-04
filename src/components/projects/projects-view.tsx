"use client";

import { ArrowRight, Calendar, Folder, Pencil } from "lucide-react";
import Image from "next/image";
import * as React from "react";
import { useState } from "react";
import { EditEventDialog } from "@/components/events/edit-event-dialog";
import { ProjectTable } from "@/components/projects/project-table";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/use-event-presence";
import type { Event, Project } from "@/lib/store";
import { useStore } from "@/lib/store";

interface ProjectsViewProps {
  readonly onRunAnalysis: (projectId: string) => void;
  readonly onBatchRun: (projectIds: string[]) => void;
  readonly onImport: () => void;
  readonly onAddProject: () => void;
  readonly onProjectClick: (project: Project) => void;
  readonly eventId?: string | null;
  readonly presenceUsers?: PresenceUser[];
}

export function ProjectsView({
  onRunAnalysis,
  onBatchRun,
  onImport,
  onAddProject,
  onProjectClick,
  eventId,
  presenceUsers,
}: ProjectsViewProps) {
  const { projects, selectedEventId, events, updateEvent } = useStore();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const activeEventId = eventId ?? selectedEventId ?? null;

  const filteredProjects = activeEventId
    ? projects.filter((p) => p.event_id === activeEventId)
    : projects;

  const activeEvent = activeEventId
    ? events.find((e) => e.id === activeEventId)
    : null;

  const projectsTitle = activeEvent?.name;
  const eventLogoUrl = activeEvent?.logo_url ?? null;

  // Format date/time for display
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, "0");

    // Include year if it's different from current year
    const dateStr =
      year !== currentYear ? `${month}/${day}/${year}` : `${month}/${day}`;

    return {
      date: dateStr,
      time: `${displayHours}:${displayMinutes}${ampm}`,
    };
  };

  // Format a single date for display (e.g. the judging-end date fallback)
  const formatSingleDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const startDateTime = formatDateTime(activeEvent?.starts_at);
  const endDateTime = formatDateTime(activeEvent?.ends_at);

  // Timer calculations with real-time updates
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second
    return () => clearInterval(interval);
  }, []);

  const timerInfo = React.useMemo(() => {
    if (!activeEvent?.starts_at || !activeEvent?.ends_at) return null;
    const now = currentTime;
    const start = new Date(activeEvent.starts_at);
    const end = new Date(activeEvent.ends_at);
    const judgingEnd = activeEvent.judging_ends_at
      ? new Date(activeEvent.judging_ends_at)
      : null;

    if (now < start) {
      // Hackathon hasn't started
      return null;
    }

    if (now >= end) {
      // Hackathon has ended
      if (judgingEnd && now < judgingEnd) {
        // Show judging timer
        const diff = judgingEnd.getTime() - now.getTime();
        const total = judgingEnd.getTime() - end.getTime();
        const progress = Math.max(
          0,
          Math.min(100, ((total - diff) / total) * 100),
        );
        return {
          type: "judging" as const,
          remaining: diff,
          progress,
        };
      }
      // Show "ended" message
      return {
        type: "ended" as const,
        message: judgingEnd ? "judging ended" : "hacking ended",
      };
    }

    // Show hackathon timer
    const diff = end.getTime() - now.getTime();
    const total = end.getTime() - start.getTime();
    const progress = Math.max(0, Math.min(100, ((total - diff) / total) * 100));
    return {
      type: "hacking" as const,
      remaining: diff,
      progress,
    };
  }, [activeEvent, currentTime]);

  const formatTimeRemaining = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}hr`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return "bg-green-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-700 dark:text-green-300";
    if (percentage >= 50) return "text-yellow-700 dark:text-yellow-300";
    return "text-red-700 dark:text-red-300";
  };

  return (
    <div className="relative flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {activeEvent && (
            <div className="relative w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex items-center justify-center">
              {eventLogoUrl ? (
                <Image
                  src={eventLogoUrl}
                  alt={`${activeEvent.name} logo`}
                  fill
                  className="object-contain p-1"
                  sizes="48px"
                  priority
                />
              ) : (
                <div />
              )}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {projectsTitle}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              {/* Hackathon Date & Time Badge; falls back to the single
                  judging-end date for events without start/end set */}
              {startDateTime && endDateTime ? (
                <Badge variant="outline">
                  <span>
                    {startDateTime.date} {startDateTime.time}
                  </span>
                  <ArrowRight className="w-3 h-3 mx-1" />
                  <span>
                    {endDateTime.date} {endDateTime.time}
                  </span>
                </Badge>
              ) : (
                formatSingleDate(activeEvent?.judging_ends_at) && (
                  <Badge variant="outline">
                    <Calendar className="w-3 h-3 mr-1" />
                    {formatSingleDate(activeEvent?.judging_ends_at)}
                  </Badge>
                )
              )}

              {/* Number of Submissions Badge */}
              <Badge variant="outline">
                <Folder className="w-3 h-3 mr-1" />
                {filteredProjects.length}
              </Badge>

              {/* Edit Event Details */}
              {activeEvent && (
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setEditingEvent(activeEvent)}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Edit Event
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {/* Timer Badge */}
          {timerInfo && timerInfo.type !== "ended" && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="relative overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-help"
                  >
                    <div
                      className="absolute inset-0 opacity-20 transition-all"
                      style={{
                        width: `${timerInfo.progress}%`,
                        backgroundColor: getProgressColor(
                          100 - timerInfo.progress,
                        ),
                      }}
                    />
                    <span
                      className={`relative z-10 font-semibold ${getProgressTextColor(
                        100 - timerInfo.progress,
                      )}`}
                    >
                      {timerInfo.type === "judging" ? "Judging: " : ""}
                      {formatTimeRemaining(timerInfo.remaining)} (
                      {Math.round(timerInfo.progress)}%)
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {timerInfo.type === "judging"
                      ? "Time remaining until judging period ends"
                      : "Time remaining until hackathon ends"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {timerInfo?.type === "ended" && (
            <Badge
              variant="outline"
              className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {timerInfo.message}
            </Badge>
          )}
        </div>
      </div>

      <div className="relative">
        <ProjectTable
          projects={filteredProjects}
          onRunAnalysis={onRunAnalysis}
          onBatchRun={onBatchRun}
          onImport={onImport}
          onAddProject={onAddProject}
          onProjectClick={onProjectClick}
          eventId={activeEventId}
          presenceUsers={presenceUsers}
        />
      </div>

      <EditEventDialog
        event={editingEvent}
        onOpenChange={(open) => {
          if (!open) setEditingEvent(null);
        }}
        onSaved={(updated) => {
          updateEvent(updated.id, updated);
          setEditingEvent(null);
        }}
      />
    </div>
  );
}
