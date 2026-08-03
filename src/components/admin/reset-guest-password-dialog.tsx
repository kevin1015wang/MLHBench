"use client";

import { useState } from "react";
import { CredentialReveal } from "@/components/admin/credential-reveal";
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

interface ResetGuestPasswordDialogProps {
  readonly guest: Guest | null;
  readonly onOpenChange: (open: boolean) => void;
}

export function ResetGuestPasswordDialog({
  guest,
  onOpenChange,
}: ResetGuestPasswordDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const handleClose = (next: boolean) => {
    if (!next) {
      setNewPassword(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const handleReset = async () => {
    if (!guest) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/guests/${guest.id}/reset-password`,
        { method: "POST" },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to reset password");
      }

      const data = await response.json();
      setNewPassword(data.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={guest !== null} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {newPassword && guest ? (
          <>
            <DialogHeader>
              <DialogTitle>Password reset</DialogTitle>
              <DialogDescription>
                Share this with them now -- it won&apos;t be shown again, and
                their old password no longer works.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <CredentialReveal email={guest.email} password={newPassword} />
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                {guest && (
                  <>
                    Generate a new password for {guest.email}? Their current
                    password stops working immediately.
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
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
