"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PrizeCategory } from "@/lib/store";
import { slugify } from "@/lib/utils/string-utils";

interface PrizeCategoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly prizeCategory: PrizeCategory | null;
  readonly initialValues?: { name?: string; slug?: string } | null;
  readonly onSaved: (prizeCategory: PrizeCategory) => void;
}

export function PrizeCategoryDialog({
  open,
  onOpenChange,
  prizeCategory,
  initialValues,
  onSaved,
}: PrizeCategoryDialogProps) {
  const isEditing = prizeCategory !== null;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [shortName, setShortName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [findWords, setFindWords] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    if (prizeCategory) {
      setName(prizeCategory.name);
      setSlug(prizeCategory.slug);
      setSlugTouched(true);
      setShortName(prizeCategory.short_name ?? "");
      setSystemPrompt(prizeCategory.system_prompt);
      setFindWords((prizeCategory.find_words ?? []).join(", "));
    } else {
      setName(initialValues?.name ?? "");
      setSlug(initialValues?.slug ?? "");
      setSlugTouched(!!initialValues?.slug);
      setShortName("");
      setSystemPrompt("");
      setFindWords("");
    }
    setError(null);
  }, [open, prizeCategory, initialValues]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const canSubmit =
    name.trim() && slug.trim() && systemPrompt.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      short_name: shortName.trim(),
      system_prompt: systemPrompt.trim(),
      find_words: findWords
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean),
    };

    try {
      const response = await fetch(
        isEditing
          ? `/api/prize-categories/${prizeCategory.id}`
          : "/api/prize-categories",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error ||
            `Failed to ${isEditing ? "update" : "create"} prize category`,
        );
      }

      const { prize_category } = await response.json();
      onSaved(prize_category);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${isEditing ? "update" : "create"} prize category`;
      setError(message);
      console.error("Failed to save prize category:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Prize Category" : "New Prize Category"}
          </DialogTitle>
          <DialogDescription>
            The system prompt is what the AI review agent uses to judge whether
            a project's code actually uses this prize's required technology.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="prize-name">Name</Label>
            <Input
              id="prize-name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Best Use of Gemini API"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prize-slug">
              Slug
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Must match the standardized prize slug on imported projects
              </span>
            </Label>
            <Input
              id="prize-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="best-use-of-gemini-api"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prize-short-name">
              Short Name
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Optional, used for compact badges
              </span>
            </Label>
            <Input
              id="prize-short-name"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Gemini API"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prize-find-words">
              Keyword Pre-filter
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Optional, comma-separated. Skips the AI call if none appear in
                the repo.
              </span>
            </Label>
            <Input
              id="prize-find-words"
              value={findWords}
              onChange={(e) => setFindWords(e.target.value)}
              placeholder="gemini, generativeai, gemini-pro"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prize-system-prompt">System Prompt</Label>
            <Textarea
              id="prize-system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe what counts as valid usage of this technology, and what to look for in the code..."
              className="min-h-32"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} type="button">
            {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
