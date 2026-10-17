import { create } from "zustand";
import type { Enums, Tables } from "@/database.types";
import type { SessionUser } from "@/lib/auth/session";

// Type aliases for cleaner code
type Event = Tables<"events">;
type Project = Tables<"projects">;
type PrizeCategory = Tables<"prize_categories">;
type ProjectRanking = Tables<"project_rankings">;
type ProjectJudge = Tables<"project_judges">;
type IgnoredPrizeSlug = Tables<"ignored_prize_slugs">;
type ProjectProcessingStatus = Enums<"project_processing_status">;
type ComplexityRating = Enums<"complexity_rating">;
type NotificationType = "info" | "success" | "warning" | "error";

interface NotificationEntry {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: string;
}

interface AppState {
  events: Event[];
  projects: Project[];
  prizeCategories: PrizeCategory[];
  projectRankings: ProjectRanking[];
  projectJudges: ProjectJudge[];
  ignoredPrizeSlugs: IgnoredPrizeSlug[];
  currentUser: SessionUser | null;
  selectedEventId: string | null;
  isProcessing: boolean;
  processingProjects: string[];
  showProcessingModal: boolean;

  recentlyViewedProjects: Array<{ id: string; timestamp: string }>;
  notifications: NotificationEntry[];

  setEvents: (events: Event[]) => void;
  setProjects: (projects: Project[]) => void;
  setPrizeCategories: (categories: PrizeCategory[]) => void;
  setProjectRankings: (rankings: ProjectRanking[]) => void;
  setProjectJudges: (judges: ProjectJudge[]) => void;
  setCurrentUser: (user: SessionUser | null) => void;
  recordProjectJudge: (projectId: string) => void;
  setIgnoredPrizeSlugs: (slugs: IgnoredPrizeSlug[]) => void;
  setSelectedEventId: (id: string | null) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  updateEvent: (id: string, updates: Partial<Event>) => void;
  addProjects: (projects: Project[]) => void;
  setProcessingProjects: (ids: string[]) => void;
  setShowProcessingModal: (open: boolean) => void;

  addRecentlyViewedProject: (projectId: string) => void;
  toggleFavoriteProject: (projectId: string) => void;
  toggleUnconsideredProject: (projectId: string) => void;
  addNotification: (entry: Omit<NotificationEntry, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

const RECORD_JUDGE_THROTTLE_MS = 60_000;

// Optimistically flips a per-project boolean in the store, then persists it.
function toggleProjectFlag(
  get: () => AppState,
  set: (fn: (state: AppState) => Partial<AppState>) => void,
  projectId: string,
  field: "is_favorite" | "is_unconsidered",
) {
  const project = get().projects.find((p) => p.id === projectId);
  if (!project) return;
  const value = !project[field];
  set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, [field]: value } : p,
    ),
  }));
  void (async () => {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("projects")
      .update({ [field]: value })
      .eq("id", projectId);
    if (error) console.error(`Failed to update ${field}:`, error);
  })();
}

export const useStore = create<AppState>((set, get) => ({
  events: [],
  projects: [],
  prizeCategories: [],
  projectRankings: [],
  projectJudges: [],
  ignoredPrizeSlugs: [],
  currentUser: null,
  selectedEventId: null,
  isProcessing: false,
  processingProjects: [],
  showProcessingModal: false,

  recentlyViewedProjects:
    typeof window !== "undefined"
      ? (() => {
          const stored = localStorage.getItem("recentlyViewedProjects");
          if (!stored) return [];
          const parsed = JSON.parse(stored);
          // Migrate old format (array of strings) to new format (array of objects)
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (typeof parsed[0] === "string") {
              return parsed.map((id: string) => ({
                id,
                timestamp: new Date().toISOString(),
              }));
            }
          }
          return parsed;
        })()
      : [],
  notifications:
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("notifications") || "[]")
      : [],

  setEvents: (events) => set({ events }),
  setProjects: (projects) => set({ projects }),
  setPrizeCategories: (prizeCategories) => set({ prizeCategories }),
  setProjectRankings: (projectRankings) => set({ projectRankings }),
  setProjectJudges: (projectJudges) => set({ projectJudges }),
  setCurrentUser: (currentUser) => set({ currentUser }),
  recordProjectJudge: (projectId) => {
    const { currentUser, projects, projectJudges } = get();
    const project = projects.find((p) => p.id === projectId);
    if (!currentUser || !project) return;

    // Notes auto-save on every pause in typing, so don't re-upsert the same
    // judge on the same project more than once a minute.
    const existing = projectJudges.find(
      (j) => j.project_id === projectId && j.judge_id === currentUser.id,
    );
    if (
      existing &&
      Date.now() - new Date(existing.last_judged_at).getTime() <
        RECORD_JUDGE_THROTTLE_MS
    ) {
      return;
    }

    const now = new Date().toISOString();
    const row = {
      event_id: project.event_id,
      project_id: projectId,
      judge_id: currentUser.id,
      judge_name:
        `${currentUser.firstName} ${currentUser.lastName}`.trim() ||
        currentUser.email ||
        "Unknown judge",
      judge_avatar_url: currentUser.avatarUrl ?? null,
      judge_role: currentUser.role,
      last_judged_at: now,
    };
    set((state) => ({
      projectJudges: existing
        ? state.projectJudges.map((j) =>
            j.id === existing.id ? { ...j, ...row } : j,
          )
        : [
            ...state.projectJudges,
            { ...row, id: `${projectId}-${currentUser.id}`, created_at: now },
          ],
    }));
    void (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase
        .from("project_judges")
        .upsert(row, { onConflict: "project_id,judge_id" });
      if (!error) return;
      console.error("Failed to record project judge:", error);
      // Undo the optimistic entry so the UI doesn't show a judge that will
      // vanish on refresh (and so the next save retries, unthrottled).
      const optimisticId = `${projectId}-${currentUser.id}`;
      set((state) => ({
        projectJudges: existing
          ? state.projectJudges.map((j) =>
              j.id === existing.id ? existing : j,
            )
          : state.projectJudges.filter((j) => j.id !== optimisticId),
      }));
    })();
  },
  setIgnoredPrizeSlugs: (ignoredPrizeSlugs) => set({ ignoredPrizeSlugs }),
  setSelectedEventId: (id) => set({ selectedEventId: id }),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    })),
  updateEvent: (id, updates) =>
    set((state) => ({
      events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  addProjects: (newProjects) =>
    set((state) => ({
      projects: [...state.projects, ...newProjects],
    })),
  setProcessingProjects: (ids) => set({ processingProjects: ids }),
  setShowProcessingModal: (open) => set({ showProcessingModal: open }),

  addRecentlyViewedProject: (projectId) =>
    set((state) => {
      const now = new Date().toISOString();
      const updated = [
        { id: projectId, timestamp: now },
        ...state.recentlyViewedProjects.filter((item) => item.id !== projectId),
      ]
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, 10); // Keep only last 10
      if (typeof window !== "undefined") {
        localStorage.setItem("recentlyViewedProjects", JSON.stringify(updated));
      }
      return { recentlyViewedProjects: updated };
    }),
  toggleFavoriteProject: (projectId) => {
    toggleProjectFlag(get, set, projectId, "is_favorite");
    get().recordProjectJudge(projectId);
  },
  toggleUnconsideredProject: (projectId) => {
    toggleProjectFlag(get, set, projectId, "is_unconsidered");
    get().recordProjectJudge(projectId);
  },
  addNotification: ({ message, type }) =>
    set((state) => {
      const entry: NotificationEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        message,
        type,
        timestamp: new Date().toISOString(),
      };
      const updated = [entry, ...state.notifications].slice(0, 200);
      if (typeof window !== "undefined") {
        localStorage.setItem("notifications", JSON.stringify(updated));
      }
      return { notifications: updated };
    }),
  removeNotification: (id) =>
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      if (typeof window !== "undefined") {
        localStorage.setItem("notifications", JSON.stringify(updated));
      }
      return { notifications: updated };
    }),
  clearNotifications: () =>
    set(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem("notifications", JSON.stringify([]));
      }
      return { notifications: [] };
    }),
}));

// Export types for use in other files
export type {
  Event,
  Project,
  ProjectProcessingStatus,
  ComplexityRating,
  NotificationEntry,
  NotificationType,
  PrizeCategory,
  ProjectRanking,
  ProjectJudge,
  IgnoredPrizeSlug,
};
