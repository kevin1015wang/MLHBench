"use client";

import { PresenceAvatars } from "@/components/navigation/presence-avatars";
import type { ProjectJudge } from "@/lib/store";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

// Who judged a project, as an avatar stack. Rows come from project_judges,
// recorded by recordProjectJudge in the store.
export function ProjectJudgeAvatars({
  judges,
  size = "sm",
}: {
  readonly judges: ProjectJudge[];
  readonly size?: "sm" | "md";
}) {
  return (
    <PresenceAvatars
      size={size}
      users={judges.map((judge) => ({
        userId: judge.judge_id,
        name: judge.judge_name,
        avatarUrl: judge.judge_avatar_url,
        role: judge.judge_role,
        detail: `Last judged ${timeFormatter.format(new Date(judge.last_judged_at))}`,
      }))}
    />
  );
}

// Judged By filter value for "nobody has judged this yet".
export const UNJUDGED_FILTER_VALUE = "__unjudged__";

// `filter` is a judge_id, UNJUDGED_FILTER_VALUE, or empty for no filter.
export function matchesJudgedByFilter(
  filter: string | null | undefined,
  judges: ProjectJudge[] | undefined,
) {
  if (!filter) return true;
  if (filter === UNJUDGED_FILTER_VALUE) return !judges?.length;
  return !!judges?.some((judge) => judge.judge_id === filter);
}

// project_id -> judges, earliest judge first.
export function groupJudgesByProject(judges: ProjectJudge[]) {
  const map = new Map<string, ProjectJudge[]>();
  for (const judge of judges) {
    const existing = map.get(judge.project_id);
    if (existing) {
      existing.push(judge);
    } else {
      map.set(judge.project_id, [judge]);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return map;
}
