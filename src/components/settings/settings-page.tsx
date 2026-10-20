"use client";

import { ExternalLink, KeyRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface KeyStatus {
  configured: boolean;
  last4: string | null;
}

interface SettingsPageProps {
  // True until the user saves their first key; the rest of Bench is locked
  // until then (see requireOnboarded).
  readonly requiresKey: boolean;
}

export function SettingsPage({ requiresKey }: SettingsPageProps) {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/openrouter-key")
      .then((response) => response.json())
      .then((data: KeyStatus) => setStatus(data))
      .catch((err) => console.error("Failed to load key status:", err));
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/me/openrouter-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to save key");
      setStatus(data);
      setApiKey("");
      if (requiresKey) {
        // Full navigation so the middleware sees the updated session cookie.
        window.location.assign("/events");
        return;
      }
      toast.success("OpenRouter key saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save key");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {requiresKey ? "Welcome to Bench" : "Settings"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {requiresKey
            ? "Bench runs its AI code and prize-track reviews on your own OpenRouter account. Add an API key to get started."
            : "Manage how AI reviews on your events are billed."}
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              OpenRouter API key
            </h2>
            <p className="text-sm text-muted-foreground">
              Bench uses your key to run code and prize-track reviews on events
              you own, including runs started by judges you invite. Your key is
              encrypted at rest and never shown again after saving.
            </p>
          </div>
          {status &&
            (status.configured ? (
              <Badge className="shrink-0 bg-green-500 text-white">
                Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0">
                Not set
              </Badge>
            ))}
        </div>

        {status?.configured && status.last4 && (
          <div className="rounded-md border px-3 py-2 font-mono text-sm text-muted-foreground">
            sk-or-…{status.last4}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-2">
          <Label htmlFor="openrouter-key">
            {status?.configured ? "Replace key" : "API key"}
          </Label>
          <div className="flex gap-2">
            <Input
              id="openrouter-key"
              type="password"
              autoComplete="off"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSaving}
              className="font-mono text-base md:text-sm"
            />
            <Button type="submit" disabled={isSaving || !apiKey.trim()}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <a
            href="https://openrouter.ai/settings/keys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Create a key on OpenRouter
            <ExternalLink className="w-3 h-3" />
          </a>
        </form>
      </Card>
    </div>
  );
}
