"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PrizeCategory } from "@/lib/store";

interface DeletePrizeCategoryDialogProps {
  readonly prizeCategory: PrizeCategory | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: (prizeCategoryId: string) => void;
}

export function DeletePrizeCategoryDialog({
  prizeCategory,
  onOpenChange,
  onDeleted,
}: DeletePrizeCategoryDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!prizeCategory) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/prize-categories/${prizeCategory.id}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete prize category");
      }

      onDeleted(prizeCategory.id);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete prize category";
      setError(message);
      console.error("Failed to delete prize category:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={prizeCategory !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Prize Category</DialogTitle>
          <DialogDescription>
            {prizeCategory && (
              <>
                Are you sure you want to delete &ldquo;{prizeCategory.name}
                &rdquo;? Projects that opted into this prize will show
                &ldquo;configuration not found&rdquo; again on their next review
                run. This can&apos;t be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            type="button"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
