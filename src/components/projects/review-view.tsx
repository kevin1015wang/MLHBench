"use client";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
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
import { ChevronDown, GripVertical, Star } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { getPrizeTracks } from "@/lib/project-utils";
import { saveProjectRankings } from "@/lib/save-project-rankings";
import type { PrizeCategory, Project, ProjectRanking } from "@/lib/store";
import { useStore } from "@/lib/store";

interface ReviewViewProps {
  readonly eventId: string | null;
  readonly projects: Project[];
  readonly prizeCategories: PrizeCategory[];
  readonly onProjectClick: (project: Project) => void;
}

type ContainerId = "ranked" | "unranked";

function RankableRow({
  project,
  rank,
  onProjectClick,
}: {
  readonly project: Project;
  readonly rank?: number;
  readonly onProjectClick: (project: Project) => void;
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
      className={`rounded-lg border border-gray-200 dark:border-[#404040] bg-white dark:bg-[#1f1f1f] p-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md dark:hover:border-gray-600 ${
        isDragging ? "opacity-50" : ""
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
      </div>
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

function DroppableColumn({
  id,
  title,
  emptyMessage,
  projectIds,
  projectsById,
  onProjectClick,
}: {
  readonly id: ContainerId;
  readonly title: string;
  readonly emptyMessage: string;
  readonly projectIds: string[];
  readonly projectsById: Map<string, Project>;
  readonly onProjectClick: (project: Project) => void;
}) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {title} ({projectIds.length})
      </h3>
      <div
        ref={setNodeRef}
        className="min-h-24 space-y-2 rounded-lg border border-dashed border-gray-200 dark:border-[#404040] p-2"
      >
        <SortableContext
          items={projectIds}
          strategy={verticalListSortingStrategy}
        >
          {projectIds.map((projectId, index) => {
            const project = projectsById.get(projectId);
            if (!project) return null;
            return (
              <RankableRow
                key={projectId}
                project={project}
                rank={id === "ranked" ? index + 1 : undefined}
                onProjectClick={onProjectClick}
              />
            );
          })}
        </SortableContext>
        {projectIds.length === 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

// One category's ranking board: its own drag context, scoped entirely to
// this category's ranked/unranked lists. Kept independent per category
// (rather than one DndContext spanning every column) since a project being
// draggable into a category it never opted into wouldn't make sense.
function CategoryColumn({
  eventId,
  category,
  eligibleFavorites,
  projectRankings,
  setProjectRankings,
  onProjectClick,
}: {
  readonly eventId: string | null;
  readonly category: PrizeCategory;
  readonly eligibleFavorites: Project[];
  readonly projectRankings: ProjectRanking[];
  readonly setProjectRankings: (rankings: ProjectRanking[]) => void;
  readonly onProjectClick: (project: Project) => void;
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
  const [containers, setContainers] = React.useState<
    Record<ContainerId, string[]>
  >({ ranked: [], unranked: [] });

  React.useEffect(() => {
    const rankedIds = projectRankings
      .filter((r) => r.prize_category_id === category.id)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.project_id)
      .filter((id) => projectsById.has(id));
    const unrankedIds = eligibleFavorites
      .map((p) => p.id)
      .filter((id) => !rankedIds.includes(id));
    setContainers({ ranked: rankedIds, unranked: unrankedIds });
  }, [category.id, projectRankings, eligibleFavorites, projectsById]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const findContainer = (id: string): ContainerId | undefined => {
    if (id === "ranked" || id === "unranked") return id;
    if (containers.ranked.includes(id)) return "ranked";
    if (containers.unranked.includes(id)) return "unranked";
    return undefined;
  };

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
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer) return;

    // Compute the next state as a plain value (not inside the setContainers
    // updater) so persisting it can happen as a normal side effect here in
    // the event handler, rather than inside a React state updater function
    // -- updaters must stay pure since React may invoke them more than once
    // (e.g. Strict Mode), which would otherwise fire duplicate, racing saves.
    const sourceItems = containers[activeContainer];
    const activeIndex = sourceItems.indexOf(activeId);

    let next: Record<ContainerId, string[]>;
    if (activeContainer === overContainer) {
      const overIndex = sourceItems.indexOf(overId);
      if (overIndex === -1 || activeIndex === overIndex) return;
      next = {
        ...containers,
        [activeContainer]: arrayMove(sourceItems, activeIndex, overIndex),
      };
    } else {
      const destItems = containers[overContainer];
      const overIndex = destItems.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : destItems.length;
      next = {
        ...containers,
        [activeContainer]: sourceItems.filter((id) => id !== activeId),
        [overContainer]: [
          ...destItems.slice(0, insertAt),
          activeId,
          ...destItems.slice(insertAt),
        ],
      };
    }
    setContainers(next);
    persist(next.ranked);
  };

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
        collisionDetection={closestCorners}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4">
          <DroppableColumn
            id="ranked"
            title="Ranked"
            emptyMessage="Drag favorited projects here to rank them"
            projectIds={containers.ranked}
            projectsById={projectsById}
            onProjectClick={onProjectClick}
          />
          <DroppableColumn
            id="unranked"
            title="Unranked favorites"
            emptyMessage="All favorited projects are ranked"
            projectIds={containers.unranked}
            projectsById={projectsById}
            onProjectClick={onProjectClick}
          />
        </div>
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
    <div className="flex gap-6 overflow-x-auto pb-4">
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
        />
      ))}
    </div>
  );
}
