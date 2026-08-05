"use client";

import { Plus, X } from "lucide-react";
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
import { usePrizeCategories } from "@/hooks/use-prize-categories";
import type { Project } from "@/lib/store";

interface EditProjectDialogProps {
  readonly project: Project | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (project: Project) => void;
}

function dedupeLinks(links: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const link of links) {
    if (!link || seen.has(link)) continue;
    seen.add(link);
    result.push(link);
  }
  return result.length > 0 ? result : [""];
}

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
  onSaved,
}: EditProjectDialogProps) {
  const { prizeCategories } = usePrizeCategories();

  const [projectTitle, setProjectTitle] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setProjectTitle(project.project_title ?? "");
    setTableNumber(project.table_number ?? "");
    setLinks(
      dedupeLinks([
        project.submission_url,
        project.github_url,
        ...(project.try_it_out_links ?? []),
      ]),
    );
    setContactName(
      [project.submitter_first_name, project.submitter_last_name]
        .filter(Boolean)
        .join(" "),
    );
    setContactEmail(project.submitter_email ?? "");
    setSelectedSlugs(project.standardized_opt_in_prizes ?? []);
    setError(null);
  }, [project]);

  const toggleTrack = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const updateLink = (index: number, value: string) => {
    setLinks((prev) => prev.map((link, i) => (i === index ? value : link)));
  };

  const removeLink = (index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = projectTitle.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!project || !canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: projectTitle.trim(),
          table_number: tableNumber.trim() || null,
          links: links.map((link) => link.trim()).filter(Boolean),
          contact_name: contactName.trim() || null,
          contact_email: contactEmail.trim() || null,
          standardized_opt_in_prizes: selectedSlugs,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save project");
      }

      const { project: updatedProject } = (await response.json()) as {
        project: Project;
      };
      onOpenChange(false);
      onSaved(updatedProject);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update this project's core details. Judging fields are edited
            directly in the detail pane.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="edit-project-name">Project Name</Label>
            <Input
              id="edit-project-name"
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Hack Name"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-project-table">Table Number</Label>
            <Input
              id="edit-project-table"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder="12"
              disabled={isSubmitting}
              className="w-24"
            />
          </div>

          <div className="space-y-2">
            <Label>
              Links
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Devpost, GitHub, demo, etc.
              </span>
            </Label>
            <div className="space-y-2">
              {links.map((link, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are only ever appended/removed at the end, never reordered
                  key={index}
                  className="flex items-center gap-2"
                >
                  <Input
                    value={link}
                    onChange={(e) => updateLink(index, e.target.value)}
                    placeholder="https://..."
                    disabled={isSubmitting}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeLink(index)}
                    disabled={isSubmitting || links.length === 1}
                    aria-label="Remove link"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setLinks((prev) => [...prev, ""])}
              disabled={isSubmitting}
              type="button"
            >
              <Plus className="h-3 w-3" />
              Add Link
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-project-contact-name">Contact Name</Label>
              <Input
                id="edit-project-contact-name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Doe"
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-contact-email">Contact Email</Label>
              <Input
                id="edit-project-contact-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="jane@example.com"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {prizeCategories.length > 0 && (
            <div className="space-y-2">
              <Label>Tracks</Label>
              <div className="flex flex-wrap gap-2">
                {prizeCategories.map((category) => {
                  const isSelected = selectedSlugs.includes(category.slug);
                  return (
                    <button
                      key={category.id}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => toggleTrack(category.slug)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        isSelected
                          ? "bg-(--mlh-blue) text-white border-(--mlh-blue)"
                          : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300"
                      }`}
                    >
                      {category.short_name || category.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
