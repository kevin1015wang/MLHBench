import { after, NextResponse } from "next/server";
import {
  getOpenRouterForEvent,
  MissingOpenRouterKeyError,
} from "@/lib/ai/openrouter";
import { requireEventAccess } from "@/lib/auth/event-access";
import { chargeGuestAiRun } from "@/lib/auth/guest-access";
import { getSession } from "@/lib/auth/session";
import { startProjectReview } from "@/lib/review/project-review";
import type { ProjectWithEvent } from "@/lib/review/types";
import { createAdminClient } from "@/lib/supabase/admin";

const POSTGREST_ERROR_NO_ROWS = "PGRST116";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    const body = await request.json().catch(() => null);
    const projectId = body?.project_id;

    if (typeof projectId !== "string" || !projectId.trim()) {
      return NextResponse.json(
        { error: "project_id is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: project, error } = await supabase
      .from("projects")
      .select("*, event:events(id, name, starts_at, ends_at, owner_user_id)")
      .eq("id", projectId.trim())
      .single();

    if (error || !project) {
      if (error?.code === POSTGREST_ERROR_NO_ROWS || !project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 },
        );
      }

      console.error("Failed to fetch project", error);
      return NextResponse.json(
        { error: "Failed to load project" },
        { status: 500 },
      );
    }

    const accessError = await requireEventAccess(session, project.event_id);
    if (accessError) return accessError;

    // Resolved before charging any guest quota, so a missing key costs
    // nothing. Self-signup events bill the owner's key; see
    // getOpenRouterForEvent.
    let openrouter: Awaited<ReturnType<typeof getOpenRouterForEvent>>;
    try {
      openrouter = await getOpenRouterForEvent(
        project.event?.owner_user_id ?? null,
      );
    } catch (keyError) {
      if (keyError instanceof MissingOpenRouterKeyError) {
        return NextResponse.json(
          { error: keyError.message, code: "missing_openrouter_key" },
          { status: 400 },
        );
      }
      console.error("Failed to load OpenRouter key", keyError);
      return NextResponse.json(
        { error: "Failed to load the event's OpenRouter key" },
        { status: 500 },
      );
    }

    // Admins run unlimited; guests draw from a fixed quota, charged upfront
    // (no refund if the run later fails -- simplest correct behavior).
    if (session?.user.role === "guest" && session.user.guestId) {
      const charged = await chargeGuestAiRun(session.user.guestId);
      if (!charged) {
        return NextResponse.json(
          { error: "AI run quota exceeded" },
          { status: 403 },
        );
      }
    }

    after(() =>
      startProjectReview(project as ProjectWithEvent, openrouter).catch(
        (processError) => {
          console.error("Project review processing failed", processError);
        },
      ),
    );

    return NextResponse.json({ status: "accepted" }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error starting review", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
