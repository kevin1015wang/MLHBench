"use client";

import { BellOff, Pause, Play, RotateCcw, Timer } from "lucide-react";
import * as React from "react";
import { useJudgingTimerContext } from "@/components/providers/judging-timer-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESET_MINUTES = [1, 2, 3, 5];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const MAX_CUSTOM_MINUTES = 99;

function CustomDurationPopover({
  duration,
  isCustom,
  onSet,
}: {
  readonly duration: number;
  readonly isCustom: boolean;
  readonly onSet: (seconds: number) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [minutes, setMinutes] = React.useState("");
  const [seconds, setSeconds] = React.useState("");

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setMinutes(String(Math.floor(duration / 60)));
      setSeconds(String(duration % 60));
    }
    setOpen(next);
  };

  const total = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
  const isValid =
    total > 0 &&
    Number(minutes || 0) <= MAX_CUSTOM_MINUTES &&
    Number(seconds || 0) < 60;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSet(total);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={isCustom ? "default" : "outline"}
          size="sm"
          className="h-7 px-2 text-xs"
        >
          {isCustom ? formatTime(duration) : "Custom"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-sm font-medium">Custom duration</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_CUSTOM_MINUTES}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-label="Minutes"
              className="h-8 text-center"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={59}
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              aria-label="Seconds"
              className="h-8 text-center"
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>min</span>
            <span>sec</span>
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={!isValid}
          >
            Set
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function JudgingTimerCard() {
  const { status, duration, remaining, start, pause, reset, setDuration } =
    useJudgingTimerContext();

  const isAlarming = status === "alarming";

  return (
    <div
      className={`bg-card border rounded-xl p-5 shadow-sm space-y-3 transition-colors ${
        isAlarming
          ? "border-red-300 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30"
          : "border-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`flex items-center gap-2 ${
            isAlarming ? "text-red-600" : "text-muted-foreground"
          }`}
        >
          <Timer className={`w-5 h-5 ${isAlarming ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium">
            {isAlarming ? "Time's up!" : "Judging Timer"}
          </span>
        </div>
        {status === "idle" && (
          <div className="flex flex-wrap gap-1">
            {PRESET_MINUTES.map((minutes) => (
              <Button
                key={minutes}
                variant={duration === minutes * 60 ? "default" : "outline"}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setDuration(minutes * 60)}
              >
                {minutes}m
              </Button>
            ))}
            <CustomDurationPopover
              duration={duration}
              isCustom={!PRESET_MINUTES.some((m) => m * 60 === duration)}
              onSet={setDuration}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div
          className={`text-4xl font-bold font-mono tabular-nums ${
            isAlarming ? "text-red-600" : "text-foreground"
          }`}
        >
          {formatTime(remaining)}
        </div>

        <div className="flex gap-2">
          {isAlarming ? (
            <Button onClick={reset} className="gap-2">
              <BellOff className="w-4 h-4" />
              Stop Alarm
            </Button>
          ) : (
            <>
              {status === "running" ? (
                <Button variant="outline" onClick={pause} className="gap-2">
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
              ) : (
                <Button onClick={start} className="gap-2">
                  <Play className="w-4 h-4" />
                  {status === "paused" ? "Resume" : "Start"}
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={reset}
                aria-label="Reset timer"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
