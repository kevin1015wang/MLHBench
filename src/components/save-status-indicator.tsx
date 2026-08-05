"use client";

import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SaveStatus } from "@/hooks/use-auto-save-field";
import { cn } from "@/lib/utils";

interface SaveStatusIndicatorProps {
  readonly status: SaveStatus;
  readonly onSave: () => Promise<void> | void;
  readonly className?: string;
  /** Icon-only status text for tight spaces (e.g. table cells). */
  readonly compact?: boolean;
  /** Whether to show the manual "Save now" button. Defaults to true. */
  readonly showButton?: boolean;
}

export function SaveStatusIndicator({
  status,
  onSave,
  className,
  compact = false,
  showButton = true,
}: SaveStatusIndicatorProps) {
  const handleSaveClick = async () => {
    try {
      await onSave();
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    }
  };

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {status === "pending" && !compact && (
        <span className="text-muted-foreground">Unsaved</span>
      )}
      {status === "saving" && (
        <span
          className="flex items-center gap-1 text-muted-foreground"
          title="Saving..."
        >
          <Loader2 className="w-3 h-3 animate-spin" />
          {!compact && "Saving..."}
        </span>
      )}
      {status === "saved" && (
        <span className="flex items-center gap-1 text-green-600" title="Saved">
          <Check className="w-3 h-3" />
          {!compact && "Saved"}
        </span>
      )}
      {status === "error" && (
        <span
          className="flex items-center gap-1 text-red-500"
          title="Failed to save"
        >
          <AlertCircle className="w-3 h-3" />
          {!compact && "Failed to save"}
        </span>
      )}
      {showButton && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={handleSaveClick}
          disabled={status === "saving"}
          aria-label="Save now"
          title="Save now"
        >
          <Save className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
