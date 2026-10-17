"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as React from "react";

import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

// Radix tooltips only open on hover/focus, so on touch devices tapping the
// trigger does nothing. Tooltip is controlled here so TooltipTrigger can
// toggle it on tap; mouse and keyboard behavior is unchanged.
const TooltipOpenContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function Tooltip({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const contextValue = React.useMemo(
    () => ({ open, setOpen }),
    [open, setOpen],
  );

  return (
    <TooltipOpenContext.Provider value={contextValue}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen} {...props} />
    </TooltipOpenContext.Provider>
  );
}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Trigger>
>(({ onPointerDown, onClick, ...props }, ref) => {
  const context = React.useContext(TooltipOpenContext);
  const isTouchRef = React.useRef(false);
  // Captured at pointerdown: a tap also fires focus (which Radix uses to
  // open) before click, so `open` by click time doesn't reflect the state
  // the user tapped from.
  const wasOpenRef = React.useRef(false);

  return (
    <TooltipPrimitive.Trigger
      ref={ref}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        isTouchRef.current = event.pointerType === "touch";
        if (isTouchRef.current && context) {
          wasOpenRef.current = context.open;
          // Skips Radix's handler, which would close the tooltip here.
          event.preventDefault();
        }
      }}
      onClick={(event) => {
        onClick?.(event);
        if (isTouchRef.current && context) {
          // Skips Radix's handler, which closes the tooltip on every click.
          event.preventDefault();
          context.setOpen(!wasOpenRef.current);
        }
      }}
      {...props}
    />
  );
});
TooltipTrigger.displayName = TooltipPrimitive.Trigger.displayName;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 whitespace-pre-line",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
