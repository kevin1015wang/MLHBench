"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useSession } from "@/hooks/use-session";
import { getProjects, recomputePrizeTracks } from "@/lib/data-service";
import { extractMlhCandidateSlugs } from "@/lib/prize-category-matching";
import { deslugify } from "@/lib/project-utils";
import {
  type IgnoredPrizeSlug,
  type PrizeCategory,
  useStore,
} from "@/lib/store";
import { DeletePrizeCategoryDialog } from "./delete-prize-category-dialog";
import {
  MissingPrizeSlugsCard,
  type MissingSlugInfo,
} from "./missing-prize-slugs-card";
import { PrizeCategoryDialog } from "./prize-category-dialog";

export function PrizeCategoriesPage() {
  useDashboardData(null);
  const { user } = useSession();
  const isAdmin = user?.role === "admin";

  const { prizeCategories, projects, events, ignoredPrizeSlugs, setProjects } =
    useStore();
  const queryClient = useQueryClient();

  // Write through the React Query cache rather than the store directly:
  // useDashboardData caches these lists forever and re-syncs the store from
  // that cache whenever it mounts, so a store-only update vanishes as soon as
  // you navigate away and back.
  const updatePrizeCategories = (
    update: (categories: PrizeCategory[]) => PrizeCategory[],
  ) =>
    queryClient.setQueryData<PrizeCategory[]>(["prize_categories"], (old) =>
      update(old ?? prizeCategories),
    );
  const updateIgnoredPrizeSlugs = (
    update: (slugs: IgnoredPrizeSlug[]) => IgnoredPrizeSlug[],
  ) =>
    queryClient.setQueryData<IgnoredPrizeSlug[]>(
      ["ignored_prize_slugs"],
      (old) => update(old ?? ignoredPrizeSlugs),
    );
  const [isRecomputing, setIsRecomputing] = useState(false);

  const [editingCategory, setEditingCategory] = useState<PrizeCategory | null>(
    null,
  );
  const [creatingFrom, setCreatingFrom] = useState<{
    name?: string;
    slug?: string;
  } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] =
    useState<PrizeCategory | null>(null);

  const configuredSlugs = useMemo(
    () =>
      new Set(
        prizeCategories.flatMap((c) => [c.slug, ...(c.alias_slugs ?? [])]),
      ),
    [prizeCategories],
  );

  const hiddenSlugs = useMemo(
    () => new Set(ignoredPrizeSlugs.map((s) => s.slug)),
    [ignoredPrizeSlugs],
  );

  // Surfaces MLH-shaped prize names (bare or "MLH: ..." prefixed entries in
  // a project's raw Opt-In Prizes) that don't match any configured category
  // yet, grouped by the event(s) they showed up on. Read from the raw text
  // rather than standardized_opt_in_prizes, which only ever holds slugs that
  // are already configured here -- see matchPrizeCategorySlugs. Slugs the
  // admin has explicitly hidden (ignoredPrizeSlugs) are excluded.
  // Every candidate slug on any imported project, with the events it showed
  // up on -- shared by the missing-configuration card and the hidden dropdown.
  const eventIdsBySlug = useMemo(() => {
    const bySlug = new Map<string, Set<string>>();
    projects.forEach((project) => {
      extractMlhCandidateSlugs(project.opt_in_prizes ?? "").forEach((slug) => {
        const eventIds = bySlug.get(slug) ?? new Set<string>();
        if (project.event_id) eventIds.add(project.event_id);
        bySlug.set(slug, eventIds);
      });
    });
    return bySlug;
  }, [projects]);

  const missingSlugs = useMemo<MissingSlugInfo[]>(() => {
    return Array.from(eventIdsBySlug.entries())
      .filter(([slug]) => !configuredSlugs.has(slug) && !hiddenSlugs.has(slug))
      .map(([slug, eventIds]) => ({
        slug,
        eventIds: Array.from(eventIds).sort((a, b) =>
          (events.find((e) => e.id === a)?.name ?? "").localeCompare(
            events.find((e) => e.id === b)?.name ?? "",
          ),
        ),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }, [eventIdsBySlug, configuredSlugs, hiddenSlugs, events]);

  const sortedCategories = useMemo(
    () =>
      [...prizeCategories].sort((a, b) =>
        (a.short_name || a.name).localeCompare(b.short_name || b.name),
      ),
    [prizeCategories],
  );

  // RLS also returns categories this user can see but not edit: the global
  // catalog, plus the private ones of event owners who invited them.
  const canEditCategory = (category: PrizeCategory) =>
    isAdmin
      ? category.owner_user_id === null
      : category.owner_user_id === user?.userId;
  // Discovered slugs can be attached as aliases to your own categories or to
  // any global one (append-only, via /aliases), so users can map their
  // hackathon's prize wording onto the built-in tracks.
  const aliasTargetCategories = sortedCategories.filter(
    (category) => canEditCategory(category) || category.owner_user_id === null,
  );

  // Projects only carry a denormalized snapshot of which catalog slugs they
  // matched at CSV-import time, so adding/editing a category or alias here
  // doesn't retroactively apply to already-imported projects on its own --
  // re-derive standardized_opt_in_prizes for every project from its raw
  // opt_in_prizes text (already stored, no CSV re-upload needed) and refresh
  // the store so the projects table reflects it immediately.
  const handleRecompute = async (options?: { silent?: boolean }) => {
    setIsRecomputing(true);
    try {
      const { updated } = await recomputePrizeTracks();
      const freshProjects = await getProjects();
      setProjects(freshProjects);
      if (!options?.silent || updated > 0) {
        toast.success(
          updated > 0
            ? `Updated prize tracks on ${updated} project${updated === 1 ? "" : "s"}`
            : "Prize tracks already up to date",
        );
      }
    } catch (err) {
      console.error("Failed to recompute prize tracks:", err);
      toast.error("Failed to update projects' prize tracks");
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleSaved = (saved: PrizeCategory) => {
    updatePrizeCategories((categories) =>
      categories.some((c) => c.id === saved.id)
        ? categories.map((c) => (c.id === saved.id ? saved : c))
        : [...categories, saved],
    );
    void handleRecompute({ silent: true });
  };

  const handleDeleted = (deletedId: string) => {
    updatePrizeCategories((categories) =>
      categories.filter((c) => c.id !== deletedId),
    );
  };

  const handleAddToExisting = async (slug: string, category: PrizeCategory) => {
    try {
      const response = await fetch(
        `/api/prize-categories/${category.id}/aliases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to add slug to category");
      }
      const { prize_category } = await response.json();
      handleSaved(prize_category);
    } catch (err) {
      console.error("Failed to add slug to existing category:", err);
      toast.error("Failed to add slug to category");
    }
  };

  const handleHide = async (slug: string) => {
    try {
      const response = await fetch("/api/ignored-prize-slugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to hide prize slug");
      }
      const { ignored_prize_slug } = await response.json();
      updateIgnoredPrizeSlugs((slugs) =>
        slugs.some((s) => s.id === ignored_prize_slug.id)
          ? slugs
          : [...slugs, ignored_prize_slug],
      );
    } catch (err) {
      console.error("Failed to hide prize slug:", err);
    }
  };

  const handleHideAll = async (slugs: string[]) => {
    const results = await Promise.allSettled(
      slugs.map(async (slug) => {
        const response = await fetch("/api/ignored-prize-slugs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error || "Failed to hide prize slug");
        }
        const { ignored_prize_slug } = await response.json();
        return ignored_prize_slug as IgnoredPrizeSlug;
      }),
    );
    const hidden = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value] : [],
    );
    updateIgnoredPrizeSlugs((existing) => [
      ...existing,
      ...hidden.filter((h) => !existing.some((s) => s.id === h.id)),
    ]);
    const failed = results.length - hidden.length;
    if (failed > 0) {
      results.forEach((r) => {
        if (r.status === "rejected")
          console.error("Failed to hide prize slug:", r.reason);
      });
      toast.error(
        `Hid ${hidden.length} of ${results.length} prize slugs; ${failed} failed`,
      );
    } else {
      toast.success(
        `Hid ${hidden.length} prize slug${hidden.length === 1 ? "" : "s"}`,
      );
    }
  };

  // Only the slugs this user can unhide: the admin manages the global list, a
  // user their own (mirrors the DELETE route's owner check).
  const unhideableSlugs = useMemo(
    () =>
      ignoredPrizeSlugs
        .filter((s) =>
          isAdmin ? s.owner_user_id === null : s.owner_user_id === user?.userId,
        )
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    [ignoredPrizeSlugs, isAdmin, user?.userId],
  );

  // Hidden slugs grouped by the event(s) whose projects use them, like the
  // missing-configuration card. Slugs no imported project uses any more go in
  // a trailing group.
  const hiddenSections = useMemo(() => {
    const byEvent = new Map<string, typeof unhideableSlugs>();
    unhideableSlugs.forEach((ignored) => {
      const eventIds = Array.from(eventIdsBySlug.get(ignored.slug) ?? []);
      (eventIds.length > 0 ? eventIds : [""]).forEach((eventId) => {
        const list = byEvent.get(eventId) ?? [];
        list.push(ignored);
        byEvent.set(eventId, list);
      });
    });
    return Array.from(byEvent.entries())
      .map(([eventId, slugs]) => ({
        eventId,
        eventName: eventId
          ? (events.find((e) => e.id === eventId)?.name ?? "Unknown event")
          : "Not on any imported project",
        slugs,
      }))
      .sort((a, b) =>
        !a.eventId
          ? 1
          : !b.eventId
            ? -1
            : a.eventName.localeCompare(b.eventName),
      );
  }, [unhideableSlugs, eventIdsBySlug, events]);

  const handleUnhide = async (slug: string) => {
    try {
      const response = await fetch(
        `/api/ignored-prize-slugs/${encodeURIComponent(slug)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to unhide prize slug");
      }
      updateIgnoredPrizeSlugs((slugs) =>
        slugs.filter(
          (s) =>
            !(
              s.slug === slug &&
              (isAdmin
                ? s.owner_user_id === null
                : s.owner_user_id === user?.userId)
            ),
        ),
      );
      toast.success(`Unhid ${deslugify(slug)}`);
    } catch (err) {
      console.error("Failed to unhide prize slug:", err);
      toast.error("Failed to unhide prize slug");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Prize Categories
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin
              ? "Configure the MLH prize tracks the AI review agent grades projects against."
              : "Add your own prize tracks for the AI review agent to grade projects against. Bench's built-in MLH tracks are always available too."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unhideableSlugs.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <EyeOff className="w-4 h-4" />
                  Hidden ({unhideableSlugs.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="max-h-80 w-72 overflow-y-auto"
              >
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Hidden prize slugs. Unhide one to configure it again.
                </DropdownMenuLabel>
                {hiddenSections.map(({ eventId, eventName, slugs }) => (
                  <DropdownMenuGroup key={eventId || "none"}>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {eventName}
                    </DropdownMenuLabel>
                    {slugs.map((ignored) => (
                      <DropdownMenuItem
                        key={ignored.id}
                        onClick={() => handleUnhide(ignored.slug)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {deslugify(ignored.slug)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />
                          Unhide
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            onClick={() => handleRecompute()}
            disabled={isRecomputing}
          >
            <RefreshCw
              className={`w-4 h-4 ${isRecomputing ? "animate-spin" : ""}`}
            />
            Sync Prize Tracks
          </Button>
          <Button
            onClick={() => {
              setCreatingFrom(null);
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            New Prize Category
          </Button>
        </div>
      </div>

      <MissingPrizeSlugsCard
        missingSlugs={missingSlugs}
        events={events}
        prizeCategories={aliasTargetCategories}
        onCreateNew={(slug) => {
          setCreatingFrom({ name: deslugify(slug), slug });
          setIsCreateDialogOpen(true);
        }}
        onAddToExisting={handleAddToExisting}
        onHide={handleHide}
        onHideAll={handleHideAll}
      />

      <div className="space-y-3">
        {sortedCategories.map((category) => (
          <Card key={category.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">
                    {category.name}
                  </h3>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {category.slug}
                  </Badge>
                  {!canEditCategory(category) && (
                    <Badge variant="outline" className="text-xs">
                      {category.owner_user_id === null
                        ? "Built-in"
                        : "Shared with you"}
                    </Badge>
                  )}
                </div>
                {(category.alias_slugs ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(category.alias_slugs ?? []).map((alias) => (
                      <Badge
                        key={alias}
                        variant="outline"
                        className="text-xs font-mono"
                      >
                        {alias}
                      </Badge>
                    ))}
                  </div>
                )}
                {category.find_words.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {category.find_words.map((word) => (
                      <Badge
                        key={word}
                        variant="outline"
                        className="text-xs font-mono"
                      >
                        {word}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm text-muted-foreground line-clamp-2 pt-1">
                  {category.system_prompt}
                </p>
              </div>
              {canEditCategory(category) && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditingCategory(category)}
                    aria-label="Edit prize category"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingCategory(category)}
                    aria-label="Delete prize category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {sortedCategories.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No prize categories configured yet.
          </div>
        )}
      </div>

      <PrizeCategoryDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        prizeCategory={null}
        initialValues={creatingFrom}
        onSaved={handleSaved}
      />

      <PrizeCategoryDialog
        open={editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCategory(null);
        }}
        prizeCategory={editingCategory}
        onSaved={handleSaved}
      />

      <DeletePrizeCategoryDialog
        prizeCategory={deletingCategory}
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(null);
        }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
