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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Guest {
  id: string;
  email: string;
  display_name: string;
  ai_run_quota: number;
  ai_run_count: number;
  created_at: string;
  event_ids: string[];
}

interface AddGuestDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (guest: Guest) => void;
}

export function AddGuestDialog({
  open,
  onOpenChange,
  onCreated,
}: AddGuestDialogProps) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    guest: Guest;
    password: string;
  } | null>(null);

  const resetForm = () => {
    setEmail("");
    setDisplayName("");
    setError(null);
    setCreated(null);
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      const createdGuest = created?.guest;
      resetForm();
      onOpenChange(false);
      if (createdGuest) onCreated(createdGuest);
      return;
    }
    onOpenChange(next);
  };

  const canSubmit = email.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/guests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          display_name: displayName.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to create guest");
      }

      const data = await response.json();
      setCreated({ guest: data.guest, password: data.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create guest");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Guest account created</DialogTitle>
              <DialogDescription>
                Share these credentials with them now -- the password won't be
                shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              <CredentialReveal
                email={created.guest.email}
                password={created.password}
              />
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
              <DialogTitle>New Guest</DialogTitle>
              <DialogDescription>
                Creates an account with a generated password and a default quota
                of 20 AI runs -- but no event access until you grant them one
                afterward.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-display-name">
                  Display Name
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    Optional
                  </span>
                </Label>
                <Input
                  id="guest-display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Jane Doe"
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
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
