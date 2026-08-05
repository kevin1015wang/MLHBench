import {
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  Loader2,
  Minus,
  Octagon,
} from "lucide-react";
import type { ProjectProcessingStatus } from "@/lib/store";
import { cn } from "@/lib/utils";

interface StatusIconProps {
  readonly status: ProjectProcessingStatus;
  readonly className?: string;
}

// Single source of truth for the icon representing each project processing
// status, so the table and the project detail header can't drift apart.
export function StatusIcon({ status, className }: StatusIconProps) {
  if (status === "processed") {
    return (
      <CheckCircle2
        className={cn("text-green-600 dark:text-green-400", className)}
      />
    );
  }
  if (status.startsWith("processing:")) {
    return (
      <Loader2
        className={cn(
          "text-blue-600 dark:text-blue-400 animate-spin",
          className,
        )}
      />
    );
  }
  if (status === "invalid:rule_violation") {
    return (
      <CalendarX
        className={cn("text-amber-600 dark:text-amber-400", className)}
      />
    );
  }
  if (status.startsWith("invalid:")) {
    return (
      <AlertTriangle
        className={cn("text-amber-600 dark:text-amber-400", className)}
      />
    );
  }
  if (status === "errored") {
    return (
      <Octagon className={cn("text-red-600 dark:text-red-400", className)} />
    );
  }
  return (
    <Minus className={cn("text-gray-500 dark:text-gray-400", className)} />
  );
}
