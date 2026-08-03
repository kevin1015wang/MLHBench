"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { EventGuestAccess } from "@/components/events/event-guest-access";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadList,
  FileUploadTrigger,
} from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Event } from "@/lib/store";
import { uploadEventImage } from "@/lib/upload-event-image";

interface EditEventDialogProps {
  readonly event: Event | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (event: Event) => void;
}

function formatForDateInput(dateString: string | null | undefined) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditEventDialog({
  event,
  onOpenChange,
  onSaved,
}: EditEventDialogProps) {
  const [logoFiles, setLogoFiles] = useState<File[]>([]);
  const [judgingEndDate, setJudgingEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setLogoFiles([]);
      setJudgingEndDate(formatForDateInput(event.judging_ends_at));
      setError(null);
    }
  }, [event]);

  const handleLogoFileValidate = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return "Only image files are allowed";
    }
    if (file.size > 5 * 1024 * 1024) {
      return "Image must be smaller than 5MB";
    }
    return null;
  };

  const handleSave = async () => {
    if (!event) return;

    setIsSaving(true);
    setError(null);
    try {
      let logoUrl: string | undefined;
      if (logoFiles.length > 0) {
        logoUrl = await uploadEventImage(logoFiles[0]);
      }

      const updates: { logo_url?: string; judging_ends_at: string | null } = {
        // Treat the date as ending at the end of that day, in local time.
        judging_ends_at: judgingEndDate
          ? new Date(`${judgingEndDate}T23:59:59`).toISOString()
          : null,
      };
      if (logoUrl) updates.logo_url = logoUrl;

      const response = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to save event details");
      }

      const { event: updatedEvent } = (await response.json()) as {
        event: Event;
      };
      onSaved(updatedEvent);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save event details";
      setError(message);
      console.error("Failed to save event details:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={event !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Event Details</DialogTitle>
          <DialogDescription>
            Set the event image and when judging ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              Event Image
              {event?.logo_url && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  Leave empty to keep the current image
                </span>
              )}
            </Label>
            <FileUpload
              value={logoFiles}
              onValueChange={setLogoFiles}
              accept="image/*"
              maxFiles={1}
              maxSize={5 * 1024 * 1024}
              onFileValidate={handleLogoFileValidate}
              disabled={isSaving}
            >
              <FileUploadDropzone className="border-2 border-dashed rounded-lg p-4 text-center hover:bg-accent/50 transition-colors">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Drag an image here
                  </div>
                  <div className="text-xs text-muted-foreground">or</div>
                  <FileUploadTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      Choose Image
                    </Button>
                  </FileUploadTrigger>
                </div>
              </FileUploadDropzone>

              <FileUploadList className="space-y-2">
                <FileUploadItem
                  value={logoFiles[0]}
                  className="flex items-center gap-3 p-3 border rounded-md bg-accent/30"
                >
                  <FileUploadItemPreview className="shrink-0" />
                  <FileUploadItemMetadata className="flex-1 min-w-0 overflow-hidden" />
                  <FileUploadItemDelete asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </FileUploadItemDelete>
                </FileUploadItem>
              </FileUploadList>
            </FileUpload>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-event-judging-end">Date (Optional)</Label>
            <Input
              id="edit-event-judging-end"
              type="date"
              value={judgingEndDate}
              onChange={(e) => setJudgingEndDate(e.target.value)}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Guest Access
              <span className="text-xs font-normal text-muted-foreground ml-2">
                Applies immediately, not tied to Save below
              </span>
            </Label>
            {event && <EventGuestAccess eventId={event.id} />}
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
