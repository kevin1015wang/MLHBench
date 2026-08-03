"use client";

import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { AddGuestDialog } from "@/components/admin/add-guest-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestSummary {
  id: string;
  email: string;
  display_name: string;
  ai_run_quota: number;
  ai_run_count: number;
  created_at: string;
  event_ids: string[];
}

interface EventGuestAccessProps {
  readonly eventId: string;
}

// Self-contained: fetches the guest list and toggles their access to this
// one event directly (immediate, not batched with the rest of the Edit
// Event form's Save button) -- matches how this worked before it lived
// here, just flipped from "per guest, pick events" to "per event, pick
// guests."
export function EventGuestAccess({ eventId }: EventGuestAccessProps) {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch("/api/admin/guests")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setGuests(data.guests ?? []);
      })
      .catch((err) => console.error("Failed to load guests:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleAccess = async (guestId: string, granted: boolean) => {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === guestId
          ? {
              ...g,
              event_ids: granted
                ? [...g.event_ids, eventId]
                : g.event_ids.filter((id) => id !== eventId),
            }
          : g,
      ),
    );

    try {
      const response = granted
        ? await fetch(`/api/admin/guests/${guestId}/access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event_id: eventId }),
          })
        : await fetch(`/api/admin/guests/${guestId}/access/${eventId}`, {
            method: "DELETE",
          });
      if (!response.ok) throw new Error("Failed to update access");
    } catch (err) {
      console.error(err);
      // Revert the optimistic update by refetching.
      const data = await fetch("/api/admin/guests").then((r) => r.json());
      setGuests(data.guests ?? []);
    }
  };

  const handleGuestCreated = (guest: GuestSummary) => {
    setGuests((prev) => [...prev, guest]);
    void toggleAccess(guest.id, true);
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
    <div className="space-y-2">
      <AddGuestDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onCreated={handleGuestCreated}
      />

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guests..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => setIsAddDialogOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          New Guest
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading guests...</p>
      ) : guests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guest accounts yet -- create one above.
        </p>
      ) : filteredGuests.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No guests match "{search}".
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
          {filteredGuests.map((guest) => {
            const granted = guest.event_ids.includes(eventId);
            const checkboxId = `event-guest-${guest.id}`;
            return (
              <div key={guest.id} className="flex items-center gap-2 px-3 py-2">
                <Checkbox
                  id={checkboxId}
                  checked={granted}
                  onCheckedChange={(checked) =>
                    toggleAccess(guest.id, checked === true)
                  }
                />
                <Label
                  htmlFor={checkboxId}
                  className="flex-1 cursor-pointer font-normal"
                >
                  <span className="text-sm">
                    {guest.display_name || guest.email}
                  </span>
                  {guest.display_name && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {guest.email}
                    </span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
