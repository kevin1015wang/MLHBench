import type { Octokit } from "@octokit/rest";
import type { OpenRouterProvider } from "@openrouter/ai-sdk-provider";
import type { Database } from "@/database.types";
import type { createAdminClient } from "@/lib/supabase/admin";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type ProjectWithEvent = ProjectRow & {
  event: Pick<EventRow, "starts_at" | "ends_at" | "owner_user_id"> | null;
};

export type GithubRepoInfo = {
  owner: string;
  repo: string;
  repoContent?: string;
  repoContentTruncated?: boolean;
};

export type SupabaseClient = ReturnType<typeof createAdminClient>;

export type ReviewContext = {
  supabase: SupabaseClient;
  github: Octokit;
  project: ProjectWithEvent;
  repoInfo?: GithubRepoInfo;
  // Billed to the event owner's key for self-signup events, or the server's
  // OPENROUTER_API_KEY for admin events -- see getOpenRouterForEvent.
  openrouter: OpenRouterProvider;
};

export type AgentResult<T> =
  | { ok: true; data?: T }
  | { ok: false; data?: undefined };

export type ReviewAgent<T> = (
  context: ReviewContext,
) => Promise<AgentResult<T>>;
