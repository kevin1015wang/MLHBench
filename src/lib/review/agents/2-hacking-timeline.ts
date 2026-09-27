import { fetchCommitDates } from "@/lib/review/github";
import { setProjectStatus } from "@/lib/review/status";
import type { ReviewAgent } from "@/lib/review/types";

type CommitDates = { firstCommitAt: string; lastCommitAt: string };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Builds a specific, judge-facing explanation of which side of the window
// was missed (start, end, or both) rather than a generic "outside window".
function buildOutsideWindowMessage(
  firstCommit: Date,
  lastCommit: Date,
  startsAt: Date,
  endsAt: Date,
): string {
  const issues: string[] = [];
  if (firstCommit < startsAt) {
    issues.push(
      `first commit (${formatDateTime(firstCommit.toISOString())}) is before the event started (${formatDateTime(startsAt.toISOString())})`,
    );
  }
  if (lastCommit > endsAt) {
    issues.push(
      `last commit (${formatDateTime(lastCommit.toISOString())}) is after the event ended (${formatDateTime(endsAt.toISOString())})`,
    );
  }
  return `Commits fall outside the event window: ${issues.join("; ")}.`;
}

export const hackingTimelineAgent: ReviewAgent<CommitDates> = async (
  context,
) => {
  if (!context.repoInfo) {
    await setProjectStatus(
      context.supabase,
      context.project.id,
      "invalid:github_inaccessible",
      "Missing repository context for timeline validation.",
    );
    return { ok: false };
  }

  console.debug(
    `Repo is accessible for project ID ${context.project.id}, proceeding to fetch commit dates.`,
  );
  const commitDates = await fetchCommitDates(context.github, context.repoInfo);
  if (!commitDates.ok) {
    const status = commitDates.message.includes("Unexpected error")
      ? "errored"
      : "invalid:github_inaccessible";

    await setProjectStatus(
      context.supabase,
      context.project.id,
      status,
      commitDates.message,
    );
    return { ok: false };
  }

  const startsAt = context.project.event?.starts_at;
  const endsAt = context.project.event?.ends_at;

  if (startsAt && endsAt) {
    const firstCommit = new Date(commitDates.firstCommitAt);
    const lastCommit = new Date(commitDates.lastCommitAt);

    if (firstCommit < new Date(startsAt) || lastCommit > new Date(endsAt)) {
      const message = buildOutsideWindowMessage(
        firstCommit,
        lastCommit,
        new Date(startsAt),
        new Date(endsAt),
      );

      console.warn(
        `Project ID ${context.project.id} has commits outside the event window -- flagging but continuing review so judges still get AI analysis.`,
      );

      // Flag the violation instead of hard-stopping: judges still want to
      // see what the team actually built, they just also need to know the
      // submission missed the window. The code review and prize category
      // agents run normally after this.
      const { error } = await context.supabase
        .from("projects")
        .update({
          commits_outside_window: true,
          commits_outside_window_message: message,
        })
        .eq("id", context.project.id);

      if (error) {
        console.error("Failed to persist commits_outside_window flag", error);
      } else {
        context.project.commits_outside_window = true;
        context.project.commits_outside_window_message = message;
      }
    }
  }

  console.debug(
    `Project ID ${context.project.id}'s commit dates are within the hacking period.`,
  );
  return { ok: true, data: commitDates };
};
