"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

interface UseAutoSaveFieldOptions<T> {
  /** Current value from the source of truth (e.g. the project record). */
  value: T;
  /** Persists the value. Throw/reject to signal failure. */
  onSave: (value: T) => Promise<void>;
  /** Debounce delay before auto-saving, in ms. Defaults to 2000. */
  debounceMs?: number;
}

/**
 * Debounced auto-save for a single field, with save-status tracking and a
 * manual flush for an explicit "Save now" action.
 *
 * Two failure modes this specifically guards against:
 * - Losing an edit that's still debouncing when the field unmounts (e.g. the
 *   user closes a panel before the 2s timer fires) — the pending value is
 *   flushed on unmount instead of being discarded.
 * - An external update (e.g. a realtime sync of an unrelated field) clobbering
 *   an edit that's in flight — incoming `value` changes are ignored while a
 *   save is pending/in-progress.
 */
export function useAutoSaveField<T>({
  value,
  onSave,
  debounceMs = 2000,
}: UseAutoSaveFieldOptions<T>) {
  const [localValue, setLocalValue] = useState<T>(value);
  const [status, setStatus] = useState<SaveStatus>("idle");

  const isDirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T>(value);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  });

  // Resync from the source value, but never clobber an edit in flight.
  useEffect(() => {
    if (isDirtyRef.current) return;
    setLocalValue(value);
  }, [value]);

  const performSave = useCallback((nextValue: T) => {
    setStatus("saving");
    return onSaveRef.current(nextValue).then(
      () => {
        isDirtyRef.current = false;
        // Stays "saved" until the next edit — no auto-revert to idle, so the
        // status is always available to check at a glance.
        setStatus("saved");
      },
      (error) => {
        console.error("Auto-save failed:", error);
        setStatus("error");
        throw error;
      },
    );
  }, []);

  // Returns a promise so callers (e.g. a manual "Save" button) can await the
  // outcome and confirm it to the user.
  const flush = useCallback((): Promise<void> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isDirtyRef.current) {
      return performSave(pendingValueRef.current);
    }
    return Promise.resolve();
  }, [performSave]);

  // Flush any unsaved edit when the field unmounts (e.g. closing the panel)
  // instead of silently discarding it.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (isDirtyRef.current) {
        void onSaveRef.current(pendingValueRef.current);
      }
    };
    // Intentionally run only on mount/unmount; latest onSave is read via ref.
  }, []);

  const handleChange = useCallback(
    (nextValue: T) => {
      setLocalValue(nextValue);
      isDirtyRef.current = true;
      pendingValueRef.current = nextValue;
      setStatus("pending");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void performSave(nextValue);
      }, debounceMs);
    },
    [debounceMs, performSave],
  );

  return { localValue, status, handleChange, flush };
}
