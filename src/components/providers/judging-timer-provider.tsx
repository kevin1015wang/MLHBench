"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
  type JudgingTimerState,
  useJudgingTimerState,
} from "@/hooks/use-judging-timer";

const JudgingTimerContext = createContext<JudgingTimerState | null>(null);

// Mounted once at the root layout so the topbar and the project detail pane
// control the exact same running timer, instead of each spinning up its own.
export function JudgingTimerProvider({ children }: { children: ReactNode }) {
  const state = useJudgingTimerState();
  return (
    <JudgingTimerContext.Provider value={state}>
      {children}
    </JudgingTimerContext.Provider>
  );
}

export function useJudgingTimerContext() {
  const context = useContext(JudgingTimerContext);
  if (!context) {
    throw new Error(
      "useJudgingTimerContext must be used within a JudgingTimerProvider",
    );
  }
  return context;
}
