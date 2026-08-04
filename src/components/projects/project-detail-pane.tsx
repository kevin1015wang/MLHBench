"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  ExternalLink,
  Gavel,
  HelpCircle,
  Info,
  LayoutTemplate,
  Loader2,
  Play,
  Star,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { DevpostIcon } from "@/components/icons/devpost-icon";
import { GithubCopilotIcon } from "@/components/icons/github-copilot-icon";
import { GithubIcon } from "@/components/icons/github-icon";
import { PresenceAvatars } from "@/components/navigation/presence-avatars";
import { JudgingTimerCard } from "@/components/projects/judging-timer-card";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { StatusBadge } from "@/components/status/status-badge";
import { StatusIcon } from "@/components/status/status-icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAutoSaveField } from "@/hooks/use-auto-save-field";
import type { PresenceUser } from "@/hooks/use-event-presence";
import { usePrizeCategories } from "@/hooks/use-prize-categories";
import { useSession } from "@/hooks/use-session";
import {
  deslugify,
  getPrizeStatusDisplay,
  getPrizeTracks,
  getStatusLabel,
  getStatusTooltipMessage,
  parsePrizeResults,
} from "@/lib/project-utils";
import { type Project, useStore } from "@/lib/store";
import { buildCopilotChatPrompt } from "@/prompts/copilot-chat";

// Persists a single project field: updates the local store immediately, then
// writes to the database. Used by the auto-save hook for each judging field.
function saveProjectField<K extends keyof Project>(
  projectId: string,
  field: K,
  updateProject: (id: string, updates: Partial<Project>) => void,
) {
  return async (value: Project[K]) => {
    updateProject(projectId, { [field]: value } as Partial<Project>);
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ [field]: value })
      .eq("id", projectId);
    if (error) throw error;
  };
}

// Component for judging score cell with debounced auto-save
function JudgingScoreInput({ project }: { readonly project: Project }) {
  const { updateProject } = useStore();
  const onSave = React.useMemo(
    () => saveProjectField(project.id, "judging_rating", updateProject),
    [project.id, updateProject],
  );
  const { localValue, status, handleChange, flush } = useAutoSaveField({
    value: project.judging_rating,
    onSave,
  });

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={localValue ?? ""}
        onChange={(e) => {
          const inputValue = e.target.value;
          const numValue =
            inputValue === ""
              ? null
              : Math.max(
                  0,
                  Math.min(10, Math.floor(Number.parseFloat(inputValue) || 0)),
                );
          handleChange(numValue);
        }}
        className="h-9 w-24 text-sm"
        placeholder="Score"
        min={0}
        max={10}
        step={1}
      />
      <SaveStatusIndicator status={status} onSave={flush} />
    </div>
  );
}

// Component for notes cell with debounced auto-save
function NotesInput({ project }: { readonly project: Project }) {
  const { updateProject } = useStore();
  const onSave = React.useMemo(
    () => saveProjectField(project.id, "judging_notes", updateProject),
    [project.id, updateProject],
  );
  const { localValue, status, handleChange, flush } = useAutoSaveField({
    value: project.judging_notes ?? "",
    onSave,
  });

  return (
    <div className="space-y-2">
      <Textarea
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full text-sm min-h-40"
        placeholder="Notes from the pitch..."
      />
      <div className="flex justify-end">
        <SaveStatusIndicator status={status} onSave={flush} />
      </div>
    </div>
  );
}

// Component for table number input with debounced auto-save
function TableNumberInput({ project }: { readonly project: Project }) {
  const { updateProject } = useStore();
  const onSave = React.useMemo(
    () => saveProjectField(project.id, "table_number", updateProject),
    [project.id, updateProject],
  );
  const { localValue, status, handleChange, flush } = useAutoSaveField({
    value: project.table_number ?? "",
    onSave,
  });

  return (
    <div className="flex items-center gap-2">
      <Input
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 w-24 text-sm"
        placeholder="Table #"
      />
      <SaveStatusIndicator status={status} onSave={flush} />
    </div>
  );
}

function getCsvRow(project: Project): Record<string, string> {
  const csvRow = project.csv_row;
  if (!csvRow || typeof csvRow !== "object" || Array.isArray(csvRow)) {
    return {};
  }
  return csvRow as Record<string, string>;
}

// Devpost's CSV export lists the primary submitter separately from up to 6
// additional "Team Member N First/Last Name/Email" columns preserved in csv_row.
function getTeamMembers(project: Project): Array<{
  name: string;
  email: string | null;
}> {
  const csvRow = getCsvRow(project);
  const members: Array<{ name: string; email: string | null }> = [];

  const primaryName = [
    project.submitter_first_name,
    project.submitter_last_name,
  ]
    .filter(Boolean)
    .join(" ");
  if (primaryName || project.submitter_email) {
    members.push({
      name: primaryName || "Submitter",
      email: project.submitter_email,
    });
  }

  for (let i = 1; i <= 6; i++) {
    const firstName = csvRow[`Team Member ${i} First Name`]?.trim();
    const lastName = csvRow[`Team Member ${i} Last Name`]?.trim();
    const email = csvRow[`Team Member ${i} Email`]?.trim();
    const name = [firstName, lastName].filter(Boolean).join(" ");
    if (name || email) {
      members.push({ name: name || "Team member", email: email || null });
    }
  }

  return members;
}

interface ProjectDetailPaneProps {
  readonly project: Project | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRerun: () => void;
  readonly presenceUsers?: PresenceUser[];
}

export function ProjectDetailPane({
  project,
  open,
  onOpenChange,
  onRerun,
  presenceUsers,
}: ProjectDetailPaneProps) {
  const {
    prizeCategoryRecord: prizeCategoryMap,
    prizeCategoryNameMap,
    prizeCategories,
  } = usePrizeCategories();
  const { toggleFavoriteProject } = useStore();
  const { user } = useSession();

  if (!project) return null;

  const otherViewers = (presenceUsers ?? []).filter(
    (p) => p.projectId === project.id && p.userId !== user?.id,
  );

  const csvRow = getCsvRow(project);
  const teamMembers = getTeamMembers(project);
  const builtWith = project.built_with
    .split(",")
    .map((tech) => tech.trim())
    .filter(Boolean);

  const disableAnalysis = project.status?.startsWith("processing") ?? false;
  const rerunLabel = project.status === "unprocessed" ? "Run" : "Re-run";

  const handleCopyCopilotPrompt = async () => {
    try {
      if (!navigator?.clipboard?.writeText) {
        toast.error("Clipboard access is not available in this browser.");
        return;
      }

      const prompt = buildCopilotChatPrompt(project, prizeCategories);

      await navigator.clipboard.writeText(prompt);

      toast.success("Prompt copied. Open GitHub Copilot and paste it.", {
        action: {
          label: "Open Copilot",
          onClick: () => {
            window.open("https://github.com/copilot", "_blank", "noopener");
          },
        },
      });
    } catch (error) {
      console.error("Failed to copy Copilot prompt", error);
      toast.error("Could not copy the Copilot prompt. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-4xl p-0 flex flex-col h-full gap-0"
        closeButtonClassName="hidden sm:flex"
        onInteractOutside={(e: {
          detail: { originalEvent: Event };
          preventDefault: () => void;
        }) => {
          const { originalEvent } = e.detail;
          const target = originalEvent.target as HTMLElement;
          if (
            target.closest(".sonner-toast") ||
            target.closest("[data-sonner-toast]")
          ) {
            e.preventDefault();
          }
        }}
      >
        <div className="p-4 sm:p-8 border-b bg-white">
          <div className="flex justify-end sm:hidden -mt-2 -mr-2 mb-1">
            <SheetClose className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleFavoriteProject(project.id)}
                  className="group p-1.5 hover:bg-gray-100 rounded-md transition-all border border-transparent hover:border-gray-200 outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                  aria-label={
                    project.is_favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${
                      project.is_favorite
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300 group-hover:text-gray-400"
                    }`}
                  />
                </button>
                <SheetTitle className="text-2xl sm:text-4xl font-bold text-gray-900 font-headline wrap-break-word leading-tight">
                  {project.project_title}
                </SheetTitle>
                {project.status === "processed" ? (
                  <StatusIcon status={project.status} className="h-6! w-6!" />
                ) : (
                  <StatusBadge
                    kind="project"
                    status={project.status}
                    tooltipTitle={getStatusLabel(project.status)}
                    tooltip={getStatusTooltipMessage(project)}
                    showInfoIcon={false}
                    noRounded
                    className="border-0 bg-transparent p-0 flex items-center justify-center shrink-0"
                  >
                    <StatusIcon status={project.status} className="h-6! w-6!" />
                  </StatusBadge>
                )}
                <div className="hidden items-center gap-2 shrink-0 sm:flex">
                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-gray-900 transition-colors"
                      title="GitHub Repository"
                    >
                      <GithubIcon className="w-6 h-6" />
                    </a>
                  )}
                  {project.submission_url && (
                    <a
                      href={project.submission_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-[#003E54] transition-colors"
                      title="Devpost Submission"
                    >
                      <DevpostIcon className="w-6 h-6" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400">Table</span>
                <TableNumberInput project={project} />
              </div>
              <Button
                size="sm"
                onClick={onRerun}
                disabled={disableAnalysis}
                variant="outline"
                className="hidden sm:inline-flex"
              >
                <Play className="h-4 w-4" />
                {rerunLabel}
              </Button>
            </div>
          </div>

          {otherViewers.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <PresenceAvatars users={otherViewers} size="sm" />
              <span className="text-sm text-gray-500">
                {otherViewers.length === 1
                  ? `${otherViewers[0].name} is also viewing this project`
                  : `${otherViewers.length} others are also viewing this project`}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6 space-y-4 bg-gray-50/50">
            <JudgingTimerCard />

            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Gavel className="w-5 h-5" />
                <span className="text-sm font-medium">Judging Notes</span>
              </div>
              <NotesInput project={project} />
            </div>

            {project.repo_content_truncated && (
              <div className="flex items-start gap-3 border border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/20 rounded-xl p-4">
                <AlertTriangle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div className="text-sm text-orange-800 dark:text-orange-300">
                  <span className="font-semibold">
                    Repository content truncated.
                  </span>{" "}
                  This repo was too large to fit in the AI model's context
                  window, so the code review and prize analysis below are based
                  on a truncated view of the code, not the full repository.
                </div>
              </div>
            )}

            {/* Bento Box Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Technical Complexity */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <LayoutTemplate className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Technical Complexity
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-gray-900 capitalize">
                      {project.technical_complexity || "N/A"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Based on tech stack and feature analysis
                  </p>
                </div>
              </div>

              {/* Description Accuracy */}
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Info className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Description Accuracy
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xl font-bold text-gray-900 capitalize">
                      {project.description_accuracy_level || "N/A"}
                    </span>
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <Markdown className="text-gray-600 line-clamp-2">
                            {project.description_accuracy_message ||
                              "No details available"}
                          </Markdown>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-md">
                        <Markdown className="text-gray-700">
                          {project.description_accuracy_message ||
                            "No details available"}
                        </Markdown>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            {/* Code Review Agent Section */}
            {project.technical_complexity_message && (
              <div className="border border-purple-100 rounded-xl p-5 bg-linear-to-br from-purple-50 to-blue-50 shadow-sm">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-(--mlh-purple) flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">
                      Code Review
                    </h3>
                    <Markdown className="text-gray-700">
                      {project.technical_complexity_message}
                    </Markdown>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    {project.tech_stack.map((tech) => (
                      <Badge
                        key={tech}
                        variant="secondary"
                        className="bg-white text-gray-700 hover:bg-gray-50"
                      >
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Prize Tracks Section */}
            {(() => {
              const prizeTracks = getPrizeTracks(project);
              const prizeResults = parsePrizeResults(project.prize_results);
              const hasPrizeTracks = prizeTracks.length > 0;
              const hasPrizeResults =
                prizeResults && Object.keys(prizeResults).length > 0;
              const showPrizeTracks = hasPrizeTracks || hasPrizeResults;
              if (!showPrizeTracks) return null;

              const unsortedTracks =
                prizeTracks.length > 0
                  ? prizeTracks
                  : prizeResults
                    ? Object.keys(prizeResults)
                    : [];

              const tracksToShow = [...unsortedTracks].sort((a, b) => {
                const getStatus = (slug: string) => {
                  const result = prizeResults ? prizeResults[slug] : null;
                  return getPrizeStatusDisplay(result).status;
                };

                const statusOrder: Record<string, number> = {
                  valid: 0,
                  invalid: 1,
                  processing: 2,
                  errored: 4,
                };

                const statusA = getStatus(a) || "unprocessed";
                const statusB = getStatus(b) || "unprocessed";

                const rankA = statusOrder[statusA] ?? 3; // 3 for unprocessed/default
                const rankB = statusOrder[statusB] ?? 3;

                return rankA - rankB;
              });

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {tracksToShow.map((trackSlug) => {
                      const result = prizeResults
                        ? prizeResults[trackSlug]
                        : null;
                      const fullName =
                        prizeCategoryNameMap.get(trackSlug) ||
                        prizeCategoryMap[trackSlug] ||
                        deslugify(trackSlug);
                      const { status, message } = getPrizeStatusDisplay(result);

                      let StatusIcon = null;

                      if (status === "valid") {
                        StatusIcon = (
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                        );
                      } else if (status === "invalid") {
                        StatusIcon = (
                          <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                            <HelpCircle className="w-5 h-5 text-orange-600" />
                          </div>
                        );
                      } else if (status === "processing") {
                        StatusIcon = (
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          </div>
                        );
                      } else if (status === "errored") {
                        StatusIcon = (
                          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                            <XCircle className="w-5 h-5 text-red-600" />
                          </div>
                        );
                      } else {
                        StatusIcon = (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={trackSlug}
                          className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex items-start gap-4">
                            {StatusIcon}
                            <div className="space-y-1">
                              <h4 className="text-xl font-semibold text-gray-900">
                                {fullName}
                              </h4>
                              <Markdown className="text-gray-600 leading-relaxed">
                                {message}
                              </Markdown>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-4 pt-4 pb-2">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Project Details
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Submission Details */}
            <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-gray-500">
                <Info className="w-5 h-5" />
                <span className="text-sm font-medium">About the Project</span>
              </div>
              {project.about_the_project ? (
                <Markdown className="text-gray-700">
                  {project.about_the_project}
                </Markdown>
              ) : (
                <p className="text-sm text-gray-500">
                  No description provided.
                </p>
              )}

              {builtWith.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {builtWith.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              )}

              {project.notes && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-medium text-gray-400 mb-1">
                    Submitter Notes
                  </div>
                  <p className="text-sm text-gray-700">{project.notes}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    Team {project.team_size ? `(${project.team_size})` : ""}
                  </span>
                </div>
                <div className="space-y-1">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <div
                        key={`${member.name}-${member.email ?? ""}`}
                        className="text-sm text-gray-700"
                      >
                        {member.name}
                        {member.email && (
                          <span className="text-gray-400">
                            {" "}
                            · {member.email}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      No team info available.
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-gray-500">
                  <Video className="w-5 h-5" />
                  <span className="text-sm font-medium">Links</span>
                </div>
                <div className="space-y-1">
                  {project.github_url && (
                    <a
                      href={project.github_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <GithubIcon className="w-3.5 h-3.5 shrink-0" />
                      GitHub Repository
                    </a>
                  )}
                  {project.submission_url && (
                    <a
                      href={project.submission_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <DevpostIcon className="w-3.5 h-3.5 shrink-0" />
                      Devpost Submission
                    </a>
                  )}
                  {project.video_demo_link && (
                    <a
                      href={project.video_demo_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      Video Demo
                    </a>
                  )}
                  {project.try_it_out_links.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      {link}
                    </a>
                  ))}
                  {!project.github_url &&
                    !project.submission_url &&
                    !project.video_demo_link &&
                    project.try_it_out_links.length === 0 && (
                      <p className="text-sm text-gray-500">
                        No additional links provided.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {project.opt_in_prizes && (
              <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-gray-500">
                  <Gavel className="w-5 h-5" />
                  <span className="text-sm font-medium">
                    All Opted-In Prizes
                  </span>
                </div>
                <p className="text-sm text-gray-700">{project.opt_in_prizes}</p>
              </div>
            )}

            {/* Raw CSV Data */}
            {Object.keys(csvRow).length > 0 && (
              <Accordion
                type="single"
                collapsible
                className="bg-white border border-gray-100 rounded-xl px-5 shadow-sm"
              >
                <AccordionItem value="raw-csv">
                  <AccordionTrigger className="text-sm font-medium text-gray-700">
                    All Submission Fields (Raw CSV Data)
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                      {Object.entries(csvRow).map(([key, value]) => (
                        <div key={key} className="min-w-0">
                          <div className="text-xs font-medium text-gray-400">
                            {key}
                          </div>
                          <div className="text-gray-700 wrap-break-word">
                            {value || "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </div>

        {/* Judging Section Sticky Footer */}
        <div className="p-4 border-t bg-white shrink-0 z-40">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-indigo-900 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                <Gavel className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Score</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <JudgingScoreInput project={project} />
            </div>
          </div>
        </div>

        <div className="fixed bottom-3 right-4 z-50">
          <Button
            size="icon"
            className="rounded-full h-12 w-12 shadow-lg bg-gray-900 text-white hover:bg-gray-800"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleCopyCopilotPrompt();
            }}
            aria-label="Chat with GitHub Copilot"
          >
            <GithubCopilotIcon className="size-7" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
