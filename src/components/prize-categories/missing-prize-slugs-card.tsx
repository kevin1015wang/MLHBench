"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deslugify } from "@/lib/project-utils";
import type { Event, PrizeCategory } from "@/lib/store";

export interface MissingSlugInfo {
  slug: string;
  eventIds: string[];
}

interface MissingPrizeSlugsCardProps {
  readonly missingSlugs: MissingSlugInfo[];
  readonly events: Event[];
  readonly prizeCategories: PrizeCategory[];
  readonly onCreateNew: (slug: string) => void;
  readonly onAddToExisting: (
    slug: string,
    category: PrizeCategory,
  ) => void | Promise<void>;
  readonly onHide: (slug: string) => void | Promise<void>;
}

export function MissingPrizeSlugsCard({
  missingSlugs,
  events,
  prizeCategories,
  onCreateNew,
  onAddToExisting,
  onHide,
}: MissingPrizeSlugsCardProps) {
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  // Group by event so slugs don't need a per-row event badge -- a slug that
  // shows up on more than one event's projects appears under each of them.
  const sections = useMemo(() => {
    const byEvent = new Map<string, MissingSlugInfo[]>();
    missingSlugs.forEach((info) => {
      const eventIds = info.eventIds.length > 0 ? info.eventIds : ["unknown"];
      eventIds.forEach((eventId) => {
        const list = byEvent.get(eventId) ?? [];
        list.push(info);
        byEvent.set(eventId, list);
      });
    });

    return Array.from(byEvent.entries())
      .map(([eventId, infos]) => ({
        eventId,
        eventName:
          eventId === "unknown"
            ? "Unknown event"
            : (events.find((e) => e.id === eventId)?.name ?? "Unknown event"),
        infos: [...infos].sort((a, b) => a.slug.localeCompare(b.slug)),
      }))
      .sort((a, b) => a.eventName.localeCompare(b.eventName));
  }, [missingSlugs, events]);

  if (missingSlugs.length === 0) return null;

  return (
    <Card className="p-5 border-orange-200 bg-orange-50/50 dark:border-orange-900 dark:bg-orange-950/20 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-900 dark:text-white">
          Missing Configuration
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          These prize slugs show up on imported projects but have no matching
          category yet, so review runs will mark them &ldquo;configuration not
          found.&rdquo; Add them as a new category, attach them as an alias of
          an existing one, or hide them if they&apos;re not actually MLH tracks.
        </p>
      </div>
      {sections.map(({ eventId, eventName, infos }) => (
        <div key={eventId} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {eventName}
          </h3>
          {infos.map(({ slug }) => (
            <div
              key={slug}
              className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-transparent border border-orange-200 dark:border-orange-900 rounded-md px-3 py-2"
            >
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {deslugify(slug)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white dark:bg-transparent"
                  onClick={() => onCreateNew(slug)}
                >
                  <Plus className="w-3 h-3" />
                  New Category
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white dark:bg-transparent"
                      disabled={
                        prizeCategories.length === 0 || pendingSlug === slug
                      }
                    >
                      Add to Existing
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {prizeCategories.map((category) => (
                      <DropdownMenuItem
                        key={category.id}
                        onClick={async () => {
                          setPendingSlug(slug);
                          try {
                            await onAddToExisting(slug, category);
                          } finally {
                            setPendingSlug(null);
                          }
                        }}
                      >
                        {category.short_name || category.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-destructive hover:bg-destructive/10"
                  aria-label="Hide prize slug"
                  onClick={() => onHide(slug)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </Card>
  );
}
