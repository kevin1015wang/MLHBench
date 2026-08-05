"use client";

import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function NotificationProvider() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={resolvedTheme as "light" | "dark" | undefined}
      richColors
      closeButton
      style={{ zIndex: 2147483647, pointerEvents: "auto" }}
      toastOptions={{
        style: { zIndex: 2147483647 },
        className: "pointer-events-auto",
      }}
    />
  );
}
