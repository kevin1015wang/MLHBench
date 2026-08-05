"use client";

import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { getProjects, recomputePrizeTracks } from "@/lib/data-service";
import { extractMlhCandidateSlugs } from "@/lib/prize-category-matching";
import { deslugify } from "@/lib/project-utils";
import { type PrizeCategory, useStore } from "@/lib/store";
import { DeletePrizeCategoryDialog } from "./delete-prize-category-dialog";
import {
  MissingPrizeSlugsCard,
  type MissingSlugInfo,
} from "./missing-prize-slugs-card";
import { PrizeCategoryDialog } from "./prize-category-dialog";

export function PrizeCategoriesPage() {
  useDashboardData(null);

  const {
    prizeCategories,
    projects,
    events,
    ignoredPrizeSlugs,
    setPrizeCategories,
    setIgnoredPrizeSlugs,
    setProjects,
  } = useStore();
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
  const missingSlugs = useMemo<MissingSlugInfo[]>(() => {
    const bySlug = new Map<string, Set<string>>();
    projects.forEach((project) => {
      extractMlhCandidateSlugs(project.opt_in_prizes ?? "").forEach((slug) => {
        if (configuredSlugs.has(slug) || hiddenSlugs.has(slug)) return;
        const eventIds = bySlug.get(slug) ?? new Set<string>();
        if (project.event_id) eventIds.add(project.event_id);
        bySlug.set(slug, eventIds);
      });
    });
    return Array.from(bySlug.entries())
      .map(([slug, eventIds]) => ({
        slug,
        eventIds: Array.from(eventIds).sort((a, b) =>
          (events.find((e) => e.id === a)?.name ?? "").localeCompare(
            events.find((e) => e.id === b)?.name ?? "",
          ),
        ),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }, [projects, configuredSlugs, hiddenSlugs, events]);

  const sortedCategories = useMemo(
    () =>
      [...prizeCategories].sort((a, b) =>
        (a.short_name || a.name).localeCompare(b.short_name || b.name),
      ),
    [prizeCategories],
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
    const exists = prizeCategories.some((c) => c.id === saved.id);
    if (exists) {
      setPrizeCategories(
        prizeCategories.map((c) => (c.id === saved.id ? saved : c)),
      );
    } else {
      setPrizeCategories([...prizeCategories, saved]);
    }
    void handleRecompute({ silent: true });
  };

  const handleDeleted = (deletedId: string) => {
    setPrizeCategories(prizeCategories.filter((c) => c.id !== deletedId));
  };

  const handleAddToExisting = async (slug: string, category: PrizeCategory) => {
    const aliasSlugs = Array.from(
      new Set([...(category.alias_slugs ?? []), slug]),
    );
    try {
      const response = await fetch(`/api/prize-categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias_slugs: aliasSlugs }),
      });
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
      setIgnoredPrizeSlugs([...ignoredPrizeSlugs, ignored_prize_slug]);
    } catch (err) {
      console.error("Failed to hide prize slug:", err);
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
            Configure the MLH prize tracks the AI review agent grades projects
            against.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        prizeCategories={sortedCategories}
        onCreateNew={(slug) => {
          setCreatingFrom({ name: deslugify(slug), slug });
          setIsCreateDialogOpen(true);
        }}
        onAddToExisting={handleAddToExisting}
        onHide={handleHide}
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
