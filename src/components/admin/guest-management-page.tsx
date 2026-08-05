"use client";

import { KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddGuestDialog } from "@/components/admin/add-guest-dialog";
import { DeleteGuestDialog } from "@/components/admin/delete-guest-dialog";
import { ResetGuestPasswordDialog } from "@/components/admin/reset-guest-password-dialog";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAutoSaveField } from "@/hooks/use-auto-save-field";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStore } from "@/lib/store";

interface Guest {
  id: string;
  email: string;
  display_name: string;
  ai_run_quota: number;
  ai_run_count: number;
  created_at: string;
  event_ids: string[];
}

export function GuestManagementPage() {
  useDashboardData(null);
  const { events } = useStore();

  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [resettingGuest, setResettingGuest] = useState<Guest | null>(null);
  const [deletingGuest, setDeletingGuest] = useState<Guest | null>(null);
  const [search, setSearch] = useState("");

  const loadGuests = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/guests");
      if (!response.ok) throw new Error("Failed to load guests");
      const data = await response.json();
      setGuests(data.guests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load guests");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGuests();
  }, [loadGuests]);

  const handleQuotaSave = async (guestId: string, quota: number) => {
    const response = await fetch(`/api/admin/guests/${guestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai_run_quota: quota }),
    });
    if (!response.ok) throw new Error("Failed to update quota");
    setGuests((prev) =>
      prev.map((g) => (g.id === guestId ? { ...g, ai_run_quota: quota } : g)),
    );
  };

  const handleGuestDeleted = (guestId: string) => {
    setGuests((prev) => prev.filter((g) => g.id !== guestId));
  };

  const query = search.trim().toLowerCase();
  const filteredGuests = query
    ? guests.filter(
        (guest) =>
          guest.display_name.toLowerCase().includes(query) ||
          guest.email.toLowerCase().includes(query),
      )
    : guests;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Guests</h1>
          <p className="text-muted-foreground mt-1">
            Create guest accounts and set their AI review run quota. Grant event
            access from each event's Edit Event dialog.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guests..."
              className="h-9 w-56 pl-8"
            />
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            New Guest
          </Button>
        </div>
      </div>

      <AddGuestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onCreated={loadGuests}
      />

      <ResetGuestPasswordDialog
        guest={resettingGuest}
        onOpenChange={(open) => {
          if (!open) setResettingGuest(null);
        }}
      />

      <DeleteGuestDialog
        guest={deletingGuest}
        onOpenChange={(open) => {
          if (!open) setDeletingGuest(null);
        }}
        onDeleted={handleGuestDeleted}
      />

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading...
        </div>
      ) : guests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No guests yet -- click "New Guest" to create one.
        </div>
      ) : filteredGuests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No guests match "{search}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGuests.map((guest) => (
            <GuestCard
              key={guest.id}
              guest={guest}
              events={events}
              onQuotaSave={(quota) => handleQuotaSave(guest.id, quota)}
              onResetPassword={() => setResettingGuest(guest)}
              onDelete={() => setDeletingGuest(guest)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestCard({
  guest,
  events,
  onQuotaSave,
  onResetPassword,
  onDelete,
}: {
  readonly guest: Guest;
  readonly events: Array<{ id: string; name: string }>;
  readonly onQuotaSave: (quota: number) => Promise<void>;
  readonly onResetPassword: () => void;
  readonly onDelete: () => void;
}) {
  const { localValue, status, handleChange, flush } = useAutoSaveField({
    value: guest.ai_run_quota,
    onSave: onQuotaSave,
  });

  const grantedEvents = events.filter((event) =>
    guest.event_ids.includes(event.id),
  );

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground">
            {guest.display_name || guest.email}
          </h3>
          <p className="text-sm text-muted-foreground">{guest.email}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            AI runs ({guest.ai_run_count} used)
          </span>
          <Input
            type="number"
            min={0}
            value={localValue}
            onChange={(e) =>
              handleChange(
                Math.max(0, Number.parseInt(e.target.value, 10) || 0),
              )
            }
            className="h-8 w-20 text-sm"
          />
          <SaveStatusIndicator
            status={status}
            onSave={flush}
            compact
            showButton={false}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={onResetPassword}
            aria-label="Reset password"
          >
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={onDelete}
            aria-label="Delete guest"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Event access
        </span>
        <div className="flex flex-wrap gap-1.5">
          {grantedEvents.length > 0 ? (
            grantedEvents.map((event) => (
              <Badge key={event.id} variant="secondary">
                {event.name}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              No event access
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
