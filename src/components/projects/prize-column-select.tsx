"use client";

import Papa from "papaparse";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const DEFAULT_PRIZE_COLUMN = "Opt-In Prizes";

// Reads just the header row of a CSV file and returns its non-empty,
// de-duplicated column names.
async function readCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 64 * 1024).text();
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const result = Papa.parse<string[]>(firstLine, { header: false });
  const headers = (result.data[0] ?? []).map((h) => h.trim()).filter(Boolean);
  return Array.from(new Set(headers));
}

// Loads the column headers of `file` and keeps `value` pointed at a valid
// column: the default prize column when present, otherwise the first column
// containing "prize", otherwise unset.
export function useCsvPrizeColumn(file: File | undefined) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [prizeColumn, setPrizeColumn] = useState("");

  useEffect(() => {
    if (!file) {
      setHeaders([]);
      setPrizeColumn("");
      return;
    }

    let cancelled = false;
    readCsvHeaders(file)
      .then((nextHeaders) => {
        if (cancelled) return;
        setHeaders(nextHeaders);
        setPrizeColumn(
          nextHeaders.includes(DEFAULT_PRIZE_COLUMN)
            ? DEFAULT_PRIZE_COLUMN
            : (nextHeaders.find((h) => /prize/i.test(h)) ?? ""),
        );
      })
      .catch((err) => {
        console.error("Failed to read CSV headers", err);
        if (cancelled) return;
        setHeaders([]);
        setPrizeColumn("");
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return { headers, prizeColumn, setPrizeColumn };
}

interface PrizeColumnSelectProps {
  readonly headers: string[];
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
}

export function PrizeColumnSelect({
  headers,
  value,
  onValueChange,
  disabled,
}: PrizeColumnSelectProps) {
  if (headers.length === 0) return null;

  return (
    <div className="space-y-2 min-w-0">
      <Label htmlFor="prize-column-select">Prize Categories Column</Label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger id="prize-column-select" className="w-full">
          <SelectValue placeholder="Select a column" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          className="max-h-64 w-(--radix-select-trigger-width)"
        >
          {headers.map((header) => (
            <SelectItem key={header} value={header} title={header}>
              <span className="truncate">{header}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        The column listing each project's selected prize categories.
      </p>
    </div>
  );
}
