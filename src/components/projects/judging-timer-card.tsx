"use client";

import { BellOff, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useJudgingTimerContext } from "@/components/providers/judging-timer-provider";
import { Button } from "@/components/ui/button";

const PRESET_MINUTES = [1, 2, 3, 5];

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function JudgingTimerCard() {
  const { status, duration, remaining, start, pause, reset, setDuration } =
    useJudgingTimerContext();

  const isAlarming = status === "alarming";

  return (
    <div
      className={`bg-white border rounded-xl p-5 shadow-sm space-y-3 transition-colors ${
        isAlarming
          ? "border-red-300 bg-red-50/50"
          : "border-gray-100 dark:border-gray-800"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={`flex items-center gap-2 ${
            isAlarming ? "text-red-600" : "text-gray-500"
          }`}
        >
          <Timer className={`w-5 h-5 ${isAlarming ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium">
            {isAlarming ? "Time's up!" : "Judging Timer"}
          </span>
        </div>
        {status === "idle" && (
          <div className="flex gap-1">
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
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div
          className={`text-4xl font-bold font-mono tabular-nums ${
            isAlarming ? "text-red-600" : "text-gray-900 dark:text-white"
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
