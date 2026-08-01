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
import type { Event } from "@/lib/store";

interface DeleteEventDialogProps {
  readonly event: Event | null;
  readonly projectCount: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: (eventId: string) => void;
}

export function DeleteEventDialog({
  event,
  projectCount,
  onOpenChange,
  onDeleted,
}: DeleteEventDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!event) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete event");
      }

      onDeleted(event.id);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete event";
      setError(message);
      console.error("Failed to delete event:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Event</DialogTitle>
          <DialogDescription>
            {event && (
              <>
                Are you sure you want to delete &ldquo;{event.name}&rdquo;? This
                will permanently delete{" "}
                {projectCount === 1 ? "1 project" : `${projectCount} projects`}{" "}
                imported into it. This can&apos;t be undone.
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
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
