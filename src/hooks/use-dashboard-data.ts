"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  getEvents,
  getPrizeCategories,
  getProjectRankings,
  getProjects,
} from "@/lib/data-service";
import { useStore } from "@/lib/store";

export function useDashboardData(activeEventId: string | null) {
  const { setEvents, setProjects, setPrizeCategories, setProjectRankings } =
    useStore();

  // 1. Fetch Events
  const {
    data: events,
    isLoading: isLoadingEvents,
    error: eventsError,
  } = useQuery({
    queryKey: ["events"],
    queryFn: () => getEvents(),
    enabled: true, // Always fetch projects, filter by event if needed
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // 2. Fetch Prize Categories
  const {
    data: prizeCategories,
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery({
    queryKey: ["prize_categories"],
    queryFn: () => getPrizeCategories(),
    enabled: true, // Always fetch projects, filter by event if needed
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // 3. Fetch Projects (dependent on activeEventId or fetch all?)
  // The original DashboardRoot fetched ALL projects if no ID, or specific if ID.
  // getProjects(eventId) handles this.
  const {
    data: projects,
    isLoading: isLoadingProjects,
    error: projectsError,
  } = useQuery({
    queryKey: ["projects", activeEventId],
    queryFn: () => getProjects(activeEventId || undefined),
    enabled: true, // Always fetch projects, filter by event if needed
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // 4. Fetch Project Rankings (dependent on activeEventId)
  const {
    data: projectRankings,
    isLoading: isLoadingRankings,
    error: rankingsError,
  } = useQuery({
    queryKey: ["project_rankings", activeEventId],
    queryFn: () => getProjectRankings(activeEventId || undefined),
    enabled: true,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // --- Synchronization Effects ---

  // Sync Events
  useEffect(() => {
    if (events) {
      setEvents(events);
    }
  }, [events, setEvents]);

  // Sync Categories
  useEffect(() => {
    if (prizeCategories) {
      setPrizeCategories(prizeCategories);
    }
  }, [prizeCategories, setPrizeCategories]);

  // Sync Projects
  useEffect(() => {
    if (projects) {
      setProjects(projects);
    }
  }, [projects, setProjects]);

  // Sync Project Rankings
  useEffect(() => {
    if (projectRankings) {
      setProjectRankings(projectRankings);
    }
  }, [projectRankings, setProjectRankings]);

  // Error Handling
  useEffect(() => {
    if (eventsError || categoriesError || projectsError || rankingsError) {
      console.error(
        "Failed to load dashboard data",
        eventsError || categoriesError || projectsError || rankingsError,
      );
      toast.error("Failed to load dashboard data");
    }
  }, [eventsError, categoriesError, projectsError, rankingsError]);

  const isLoading =
    isLoadingEvents ||
    isLoadingCategories ||
    isLoadingProjects ||
    isLoadingRankings;

  return {
    isLoading,
  };
}
