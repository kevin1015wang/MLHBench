"use client";

import { Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EventMember {
  id: string;
  email: string;
  name: string;
  joined: boolean;
  created_at: string;
}

interface EventMembersProps {
  readonly eventId: string;
}

// Co-judges on a self-signup user's event. Like EventGuestAccess, changes
// apply immediately rather than waiting on the Edit Event form's Save.
// Invites are by email and work before the person has ever signed in.
export function EventMembers({ eventId }: EventMembersProps) {
  const [members, setMembers] = useState<EventMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch(`/api/events/${eventId}/members`)
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) setMembers(data.members ?? []);
      })
      .catch((err) => console.error("Failed to load judges:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsInviting(true);
    setError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to invite judge");
      }
      setMembers(data.members ?? []);
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite judge");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    const previous = members;
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    try {
      const response = await fetch(
        `/api/events/${eventId}/members/${memberId}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error("Failed to remove judge");
    } catch (err) {
      console.error(err);
      setMembers(previous);
    }
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleInvite} className="flex items-center gap-2">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="judge@example.com"
          className="h-8 text-base md:text-sm"
          disabled={isInviting}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isInviting || !email.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Invited judges sign in with Google using this email. AI reviews they run
        are billed to your OpenRouter key.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading judges...</p>
      ) : members.length === 0 ? null : (
        <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0 text-sm truncate">
                {member.name || member.email}
                {member.name && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {member.email}
                  </span>
                )}
              </div>
              {!member.joined && (
                <Badge variant="outline" className="text-xs shrink-0">
                  Invited
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(member.id)}
                aria-label={`Remove ${member.email}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
