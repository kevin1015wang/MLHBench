"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
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
import { type Event, useStore } from "@/lib/store";

interface NewEventDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

// Devpost project exports are named like:
// projects-<event-slug>-sensitive-info-<uuid>-<date>-<time>.csv
const DEVPOST_FILENAME_PATTERN = /^projects-(.+?)-sensitive-info-/;

function guessEventNameFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.csv$/i, "");
  const match = withoutExtension.match(DEVPOST_FILENAME_PATTERN);
  if (!match) return "";

  return match[1]
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function NewEventDialog({ open, onOpenChange }: NewEventDialogProps) {
  const router = useRouter();
  const setEvents = useStore((state) => state.setEvents);

  const [files, setFiles] = useState<File[]>([]);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFiles([]);
    setName("");
    setError(null);
  }, []);

  const handleFileValidate = (file: File) => {
    if (!file.name.endsWith(".csv")) {
      return "Only CSV files are allowed";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "File must be smaller than 10MB";
    }
    return null;
  };

  const handleFilesChange = (newFiles: File[]) => {
    setFiles(newFiles);
    if (newFiles.length > 0 && !name) {
      const guessed = guessEventNameFromFilename(newFiles[0].name);
      if (guessed) setName(guessed);
    }
  };

  const canSubmit = files.length > 0 && name.trim() && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const eventResponse = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!eventResponse.ok) {
        const data = await eventResponse.json().catch(() => null);
        throw new Error(data?.error || "Failed to create event");
      }

      const { event } = (await eventResponse.json()) as { event: Event };

      const formData = new FormData();
      formData.append("file", files[0]);
      formData.append("event_id", event.id);

      const importResponse = await fetch("/api/projects/import-csv", {
        method: "POST",
        body: formData,
      });

      if (!importResponse.ok) {
        const data = await importResponse.json().catch(() => null);
        throw new Error(
          data?.error ||
            "Event was created, but importing the CSV failed. Open the event and try importing again.",
        );
      }

      setEvents([...useStore.getState().events, event]);
      reset();
      onOpenChange(false);
      router.push(`/events/${event.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create event";
      setError(message);
      console.error("Failed to create event:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Event</DialogTitle>
          <DialogDescription>
            Upload a Devpost Project Submissions export to create a new
            hackathon event and import its projects.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-w-0 py-2">
          <FileUpload
            value={files}
            onValueChange={handleFilesChange}
            accept=".csv"
            maxFiles={1}
            maxSize={10 * 1024 * 1024}
            onFileValidate={handleFileValidate}
            disabled={isSubmitting}
          >
            <FileUploadDropzone className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  Drag CSV file here
                </div>
                <div className="text-xs text-muted-foreground">or</div>
                <FileUploadTrigger asChild>
                  <Button variant="outline" size="sm" type="button">
                    Choose File
                  </Button>
                </FileUploadTrigger>
              </div>
            </FileUploadDropzone>

            <FileUploadList className="space-y-2">
              <FileUploadItem
                value={files[0]}
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

          <div className="space-y-2">
            <Label htmlFor="new-event-name">Event Name</Label>
            <Input
              id="new-event-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hack the Valley Hack Day"
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
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} type="button">
            {isSubmitting ? "Creating..." : "Create Event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
