"use client";

import { useCallback, useEffect, useState } from "react";
import { SaveStatusIndicator } from "@/components/save-status-indicator";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAutoSaveField } from "@/hooks/use-auto-save-field";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useStore } from "@/lib/store";

interface Guest {
  id: string;
  username: string;
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

  const toggleEventAccess = async (
    guestId: string,
    eventId: string,
    granted: boolean,
  ) => {
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
      // Revert the optimistic update by reloading from the server.
      void loadGuests();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Manage Guests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Grant guest accounts access to events and set their AI review run
          quota. Guests sign themselves up at /signup with zero access by
          default.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : guests.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No guests have signed up yet.
        </div>
      ) : (
        <div className="space-y-3">
          {guests.map((guest) => (
            <GuestCard
              key={guest.id}
              guest={guest}
              events={events}
              onQuotaSave={(quota) => handleQuotaSave(guest.id, quota)}
              onToggleEventAccess={(eventId, granted) =>
                toggleEventAccess(guest.id, eventId, granted)
              }
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
  onToggleEventAccess,
}: {
  readonly guest: Guest;
  readonly events: Array<{ id: string; name: string }>;
  readonly onQuotaSave: (quota: number) => Promise<void>;
  readonly onToggleEventAccess: (eventId: string, granted: boolean) => void;
}) {
  const { localValue, status, handleChange, flush } = useAutoSaveField({
    value: guest.ai_run_quota,
    onSave: onQuotaSave,
  });

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {guest.display_name || guest.username}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            @{guest.username}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-400">
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
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-400">Event access</span>
        <div className="flex flex-wrap gap-3">
          {events.map((event) => {
            const granted = guest.event_ids.includes(event.id);
            const checkboxId = `guest-${guest.id}-event-${event.id}`;
            return (
              <label
                key={event.id}
                htmlFor={checkboxId}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  id={checkboxId}
                  checked={granted}
                  onCheckedChange={(checked) =>
                    onToggleEventAccess(event.id, checked === true)
                  }
                />
                {event.name}
              </label>
            );
          })}
          {events.length === 0 && (
            <span className="text-sm text-gray-500">No events yet.</span>
          )}
        </div>
      </div>
    </Card>
  );
}
