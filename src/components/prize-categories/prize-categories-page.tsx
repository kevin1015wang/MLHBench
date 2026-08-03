"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { deslugify, getPrizeTracks } from "@/lib/project-utils";
import { type PrizeCategory, useStore } from "@/lib/store";
import { DeletePrizeCategoryDialog } from "./delete-prize-category-dialog";
import { PrizeCategoryDialog } from "./prize-category-dialog";

export function PrizeCategoriesPage() {
  useDashboardData(null);

  const { prizeCategories, projects, setPrizeCategories } = useStore();

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
    () => new Set(prizeCategories.map((c) => c.slug)),
    [prizeCategories],
  );

  const missingSlugs = useMemo(() => {
    const slugs = new Set<string>();
    projects.forEach((project) => {
      getPrizeTracks(project).forEach((slug) => {
        if (!configuredSlugs.has(slug)) {
          slugs.add(slug);
        }
      });
    });
    return Array.from(slugs).sort();
  }, [projects, configuredSlugs]);

  const sortedCategories = useMemo(
    () =>
      [...prizeCategories].sort((a, b) =>
        (a.short_name || a.name).localeCompare(b.short_name || b.name),
      ),
    [prizeCategories],
  );

  const handleSaved = (saved: PrizeCategory) => {
    const exists = prizeCategories.some((c) => c.id === saved.id);
    if (exists) {
      setPrizeCategories(
        prizeCategories.map((c) => (c.id === saved.id ? saved : c)),
      );
    } else {
      setPrizeCategories([...prizeCategories, saved]);
    }
  };

  const handleDeleted = (deletedId: string) => {
    setPrizeCategories(prizeCategories.filter((c) => c.id !== deletedId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Prize Categories
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure the MLH prize tracks the AI review agent grades projects
            against.
          </p>
        </div>
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

      {missingSlugs.length > 0 && (
        <Card className="p-5 border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Missing Configuration
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              These prize slugs show up on imported projects but have no
              matching category yet, so review runs will mark them
              &ldquo;configuration not found.&rdquo;
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingSlugs.map((slug) => (
              <Button
                key={slug}
                variant="outline"
                size="sm"
                className="bg-white dark:bg-transparent"
                onClick={() => {
                  setCreatingFrom({ name: deslugify(slug), slug });
                  setIsCreateDialogOpen(true);
                }}
              >
                <Plus className="w-3 h-3" />
                {deslugify(slug)}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {sortedCategories.map((category) => (
          <Card key={category.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
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
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 pt-1">
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
                  className="h-8 w-8 text-gray-400 hover:text-destructive hover:bg-destructive/10"
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
          <div className="text-center py-12 text-gray-500">
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
