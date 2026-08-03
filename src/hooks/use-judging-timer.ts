"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type JudgingTimerStatus = "idle" | "running" | "paused" | "alarming";

const DEFAULT_DURATION_SECONDS = 120; // The 2-minute limit this was built for
const ALARM_SOUND_SRC = "/sounds/timersound.mp3";

// The single instance of this hook is owned by JudgingTimerProvider (see
// judging-timer-provider.tsx) and shared via context to every consumer --
// the topbar and the project detail pane both need to read/control the same
// running timer, not each get their own. That provider is mounted at the
// root layout, so the countdown/alarm keeps running across popover
// open/close, project navigation, and route changes; it only stops when the
// judge explicitly stops it or actually leaves the app.
export function useJudgingTimerState() {
  const [duration, setDurationState] = useState(DEFAULT_DURATION_SECONDS);
  const [remaining, setRemaining] = useState(DEFAULT_DURATION_SECONDS);
  const [status, setStatus] = useState<JudgingTimerStatus>("idle");

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAlarmAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(ALARM_SOUND_SRC);
      audio.loop = true;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  // Browsers only allow programmatic playback that's triggered by (or
  // chained from) a real user gesture. The alarm actually starts later, on
  // its own timer tick, well outside any click's call stack -- so "unlock"
  // the element here, during the Start click, by playing and immediately
  // pausing it.
  const unlockAlarmAudio = useCallback(() => {
    const audio = getAlarmAudio();
    audio
      .play()
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
      })
      .catch(() => {});
  }, [getAlarmAudio]);

  const stopAlarmSound = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  const startAlarmSound = useCallback(() => {
    const audio = getAlarmAudio();
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, [getAlarmAudio]);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Countdown tick
  useEffect(() => {
    if (status !== "running") return;
    countdownRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setStatus("alarming");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return clearCountdown;
  }, [status, clearCountdown]);

  // Alarm loop, driven purely by status
  useEffect(() => {
    if (status === "alarming") {
      startAlarmSound();
    }
    return stopAlarmSound;
  }, [status, startAlarmSound, stopAlarmSound]);

  // Only stops when the judge leaves the app entirely (tab close/reload) --
  // TopBar, where this hook lives, is mounted for the whole SPA session.
  useEffect(() => {
    return () => {
      clearCountdown();
      stopAlarmSound();
    };
  }, [clearCountdown, stopAlarmSound]);

  const start = useCallback(() => {
    unlockAlarmAudio();
    setRemaining((prev) => (status === "paused" ? prev : duration));
    setStatus("running");
  }, [status, duration, unlockAlarmAudio]);

  const pause = useCallback(() => {
    setStatus((prev) => (prev === "running" ? "paused" : prev));
  }, []);

  // Also doubles as "Stop Alarm" -- silences the sound and resets to the
  // configured duration, ready for the next team.
  const reset = useCallback(() => {
    clearCountdown();
    setStatus("idle");
    setRemaining(duration);
  }, [duration, clearCountdown]);

  const setDuration = useCallback(
    (seconds: number) => {
      setDurationState(seconds);
      if (status === "idle") {
        setRemaining(seconds);
      }
    },
    [status],
  );

  return { status, duration, remaining, start, pause, reset, setDuration };
}

export type JudgingTimerState = ReturnType<typeof useJudgingTimerState>;
