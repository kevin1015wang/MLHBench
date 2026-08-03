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

interface Guest {
  id: string;
  email: string;
}

interface DeleteGuestDialogProps {
  readonly guest: Guest | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDeleted: (guestId: string) => void;
}

export function DeleteGuestDialog({
  guest,
  onOpenChange,
  onDeleted,
}: DeleteGuestDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!guest) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/guests/${guest.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete guest");
      }

      onDeleted(guest.id);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete guest";
      setError(message);
      console.error("Failed to delete guest:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={guest !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Guest</DialogTitle>
          <DialogDescription>
            {guest && (
              <>
                Are you sure you want to delete {guest.email}? They&apos;ll
                immediately lose access to every event and won&apos;t be able to
                log in again. This can&apos;t be undone.
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
