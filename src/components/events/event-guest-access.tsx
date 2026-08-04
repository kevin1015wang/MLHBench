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

async function fetchGuests(): Promise<GuestSummary[]> {
  const response = await fetch("/api/admin/guests");
  const data = await response.json();
  return data.guests ?? [];
}

// Self-contained: fetches the guest list, shows only who's already granted
// access to this event, and lets you search the rest of the guest roster to
// add more (immediate, not batched with the rest of the Edit Event form's
// Save button).
export function EventGuestAccess({ eventId }: EventGuestAccessProps) {
  const [guests, setGuests] = useState<GuestSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetchGuests()
      .then((data) => {
        if (!cancelled) setGuests(data);
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
      setGuests(await fetchGuests());
    }
  };

  const handleGuestCreated = (guest: GuestSummary) => {
    setGuests((prev) => [...prev, guest]);
    void toggleAccess(guest.id, true);
  };

  const handleAddExisting = (guest: GuestSummary) => {
    setSearch("");
    setIsSearchFocused(false);
    void toggleAccess(guest.id, true);
  };

  const grantedGuests = guests.filter((g) => g.event_ids.includes(eventId));

  const query = search.trim().toLowerCase();
  const searchResults =
    query.length > 0
      ? guests
          .filter(
            (g) =>
              !g.event_ids.includes(eventId) &&
              (g.display_name.toLowerCase().includes(query) ||
                g.email.toLowerCase().includes(query)),
          )
          .slice(0, 8)
      : [];
  const showDropdown = isSearchFocused && query.length > 0;

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
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
            placeholder="Search guests to add..."
            className="h-8 pl-8 text-sm"
          />
          {showDropdown && (
            <div className="absolute z-10 mt-1 w-full border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto divide-y">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matching guests
                </p>
              ) : (
                searchResults.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAddExisting(guest)}
                    className="group w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    {guest.display_name || guest.email}
                    {guest.display_name && (
                      <span className="text-xs text-muted-foreground group-hover:text-accent-foreground ml-2">
                        {guest.email}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
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
      ) : grantedGuests.length === 0 ? null : (
        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
          {grantedGuests.map((guest) => {
            const checkboxId = `event-guest-${guest.id}`;
            return (
              <div key={guest.id} className="flex items-center gap-2 px-3 py-2">
                <Checkbox
                  id={checkboxId}
                  checked={true}
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
