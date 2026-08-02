"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, GripVertical, Star } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePrizeCategories } from "@/hooks/use-prize-categories";
import { deslugify, getPrizeTracks } from "@/lib/project-utils";
import { saveProjectRankings } from "@/lib/save-project-rankings";
import type { PrizeCategory, Project, ProjectRanking } from "@/lib/store";
import { useStore } from "@/lib/store";

interface ReviewViewProps {
  readonly eventId: string | null;
  readonly projects: Project[];
  readonly prizeCategories: PrizeCategory[];
  readonly onProjectClick: (project: Project) => void;
}

// Sentinel row separating ranked from unranked projects within a single
// sortable list -- see CategoryColumn for why this replaced two separate
// drag-and-drop containers.
const DIVIDER_ID = "__unranked_divider__";

function RankableRow({
  project,
  rank,
  onProjectClick,
  isMultiFirst,
}: {
  readonly project: Project;
  readonly rank?: number;
  readonly onProjectClick: (project: Project) => void;
  readonly isMultiFirst: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [notesExpanded, setNotesExpanded] = React.useState(false);
  const [notesOverflowing, setNotesOverflowing] = React.useState(false);
  const notesRef = React.useRef<HTMLParagraphElement>(null);
  const toggleFavoriteProject = useStore(
    (state) => state.toggleFavoriteProject,
  );
  const { prizeCategoryMap } = usePrizeCategories();
  const prizeTracks = getPrizeTracks(project);

  // Measured once against the clamped (2-line) layout, so it reflects
  // whether there's actually more text to reveal -- not re-measured after
  // expanding, since the element is no longer clamped at that point.
  React.useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    setNotesOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg border border-gray-200 dark:border-[#404040] bg-white dark:bg-[#1f1f1f] p-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:hover:border-gray-600 ${
        isDragging ? "z-50 opacity-50" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="shrink-0 cursor-grab touch-none text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        {rank !== undefined && (
          <Badge variant="outline" className="shrink-0 font-mono">
            #{rank}
          </Badge>
        )}
        {rank === 1 && isMultiFirst && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Also ranked #1 in another prize category</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <button
          type="button"
          onClick={() => onProjectClick(project)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {project.project_title || "Untitled"}
          </div>
        </button>
        {project.judging_rating !== null &&
          project.judging_rating !== undefined && (
            <Badge variant="outline" className="shrink-0">
              {project.judging_rating}/10
            </Badge>
          )}
        <button
          type="button"
          onClick={() => toggleFavoriteProject(project.id)}
          className="shrink-0 rounded-md p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Remove from favorites"
        >
          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
        </button>
      </div>
      {prizeTracks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 pl-7">
          {prizeTracks.map((slug) => (
            <Badge key={slug} variant="outline" className="text-xs font-normal">
              {prizeCategoryMap.get(slug) || deslugify(slug)}
            </Badge>
          ))}
        </div>
      )}
      {project.judging_notes && (
        <div className="mt-2 pl-7">
          <p
            ref={notesRef}
            className={`whitespace-pre-wrap text-xs text-gray-600 dark:text-gray-400 ${
              notesExpanded ? "" : "line-clamp-2"
            }`}
          >
            {project.judging_notes}
          </p>
          {notesOverflowing && (
            <button
              type="button"
              onClick={() => setNotesExpanded((prev) => !prev)}
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  notesExpanded ? "rotate-180" : ""
                }`}
              />
              {notesExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Non-draggable row marking the boundary between ranked and unranked
// projects. Still participates in the same SortableContext (via useSortable
// with `disabled`) so dnd-kit tracks its position and other rows can be
// dropped above/below it.
function DividerRow({ unrankedCount }: { readonly unrankedCount: number }) {
  const { setNodeRef } = useSortable({ id: DIVIDER_ID, disabled: true });

  return (
    <div ref={setNodeRef} className="flex items-center gap-2 py-1">
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
      <span className="shrink-0 text-xs text-muted-foreground">
        Unranked favorites ({unrankedCount})
      </span>
      <div className="h-px flex-1 bg-gray-300 dark:bg-gray-600" />
    </div>
  );
}

// One category's ranking board: a single sortable list per category (rather
// than two separate drag-and-drop containers) with a divider row splitting
// ranked from unranked projects. Everything above the divider is ranked, in
// order; everything below is unranked (order among them isn't persisted).
// This sidesteps cross-container collision detection entirely -- dnd-kit's
// single-list sortable is its most solid, well-tested path, and "ranking" a
// project just means dragging it above the divider.
function CategoryColumn({
  eventId,
  category,
  eligibleFavorites,
  projectRankings,
  setProjectRankings,
  onProjectClick,
  multiFirstProjectIds,
}: {
  readonly eventId: string | null;
  readonly category: PrizeCategory;
  readonly eligibleFavorites: Project[];
  readonly projectRankings: ProjectRanking[];
  readonly setProjectRankings: (rankings: ProjectRanking[]) => void;
  readonly onProjectClick: (project: Project) => void;
  readonly multiFirstProjectIds: Set<string>;
}) {
  const projectsById = React.useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of eligibleFavorites) {
      map.set(p.id, p);
    }
    return map;
  }, [eligibleFavorites]);

  // Local drag state, resynced from the store whenever the underlying data
  // changes.
  const [itemIds, setItemIds] = React.useState<string[]>([DIVIDER_ID]);

  React.useEffect(() => {
    const rankedIds = projectRankings
      .filter((r) => r.prize_category_id === category.id)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.project_id)
      .filter((id) => projectsById.has(id));
    const unrankedIds = eligibleFavorites
      .map((p) => p.id)
      .filter((id) => !rankedIds.includes(id));
    setItemIds([...rankedIds, DIVIDER_ID, ...unrankedIds]);
  }, [category.id, projectRankings, eligibleFavorites, projectsById]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const persist = (rankedIds: string[]) => {
    if (!eventId) return;
    const now = new Date().toISOString();
    setProjectRankings([
      ...projectRankings.filter((r) => r.prize_category_id !== category.id),
      ...rankedIds.map((projectId, index) => ({
        id: `${category.id}-${projectId}`,
        event_id: eventId,
        project_id: projectId,
        prize_category_id: category.id,
        rank: index + 1,
        created_at: now,
        updated_at: now,
      })),
    ]);
    saveProjectRankings(eventId, category.id, rankedIds).catch((error) => {
      console.error("Failed to save project rankings:", error);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(itemIds, oldIndex, newIndex);
    setItemIds(next);
    const dividerIndex = next.indexOf(DIVIDER_ID);
    persist(next.slice(0, dividerIndex));
  };

  const dividerIndex = itemIds.indexOf(DIVIDER_ID);

  return (
    <div className="w-96 shrink-0 rounded-xl bg-gray-50 dark:bg-[#262626] p-4">
      <div className="mb-4 flex items-center gap-2">
        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
          {category.name}
        </h2>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {itemIds.map((id, index) => {
              if (id === DIVIDER_ID) {
                return (
                  <DividerRow
                    key={id}
                    unrankedCount={itemIds.length - dividerIndex - 1}
                  />
                );
              }
              const project = projectsById.get(id);
              if (!project) return null;
              return (
                <RankableRow
                  key={id}
                  project={project}
                  rank={index < dividerIndex ? index + 1 : undefined}
                  onProjectClick={onProjectClick}
                  isMultiFirst={multiFirstProjectIds.has(id)}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function ReviewView({
  eventId,
  projects,
  prizeCategories,
  onProjectClick,
}: ReviewViewProps) {
  const { projectRankings, setProjectRankings } = useStore();

  const favoritedProjects = React.useMemo(
    () => projects.filter((p) => p.is_favorite),
    [projects],
  );

  // Only categories with a real catalog row (so we have a prize_category_id
  // to key rankings on) and at least one favorited, eligible project.
  const eligibleCategories = React.useMemo(
    () =>
      prizeCategories.filter((cat) =>
        favoritedProjects.some((p) => getPrizeTracks(p).includes(cat.slug)),
      ),
    [prizeCategories, favoritedProjects],
  );

  // Projects displayed as #1 in more than one category, worth flagging since
  // it usually means a call still needs to be made on which category it
  // actually wins. This has to mirror the same eligibility filtering each
  // CategoryColumn applies to its own ranked list -- a project's stored
  // `rank` can be 1 while it's no longer shown at #1 (e.g. the true #1 was
  // since unfavorited, leaving its ranking row orphaned but still in the DB),
  // so the "first surviving entry" is what actually renders as #1, not
  // necessarily whichever row has rank === 1.
  const multiFirstProjectIds = React.useMemo(() => {
    const firstPlaceCounts = new Map<string, number>();
    for (const cat of eligibleCategories) {
      const eligibleIds = new Set(
        favoritedProjects
          .filter((p) => getPrizeTracks(p).includes(cat.slug))
          .map((p) => p.id),
      );
      const displayedFirst = projectRankings
        .filter(
          (r) =>
            r.prize_category_id === cat.id && eligibleIds.has(r.project_id),
        )
        .sort((a, b) => a.rank - b.rank)[0]?.project_id;
      if (displayedFirst) {
        firstPlaceCounts.set(
          displayedFirst,
          (firstPlaceCounts.get(displayedFirst) ?? 0) + 1,
        );
      }
    }
    const ids = Array.from(firstPlaceCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
    return new Set(ids);
  }, [eligibleCategories, favoritedProjects, projectRankings]);

  if (favoritedProjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 dark:border-[#404040] py-16 text-center text-sm text-muted-foreground">
        No favorited projects yet. Favorite a project by clicking the star icon
        for it to show up here.
      </div>
    );
  }

  if (eligibleCategories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 dark:border-[#404040] py-16 text-center text-sm text-muted-foreground">
        No favorited projects have opted into an MLH prize category yet.
      </div>
    );
  }

  return (
    <div className="flex gap-6 overflow-x-auto overflow-y-visible pb-4">
      {eligibleCategories.map((cat) => (
        <CategoryColumn
          key={cat.id}
          eventId={eventId}
          category={cat}
          eligibleFavorites={favoritedProjects.filter((p) =>
            getPrizeTracks(p).includes(cat.slug),
          )}
          projectRankings={projectRankings}
          setProjectRankings={setProjectRankings}
          onProjectClick={onProjectClick}
          multiFirstProjectIds={multiFirstProjectIds}
        />
      ))}
    </div>
  );
}
