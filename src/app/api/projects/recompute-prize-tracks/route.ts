import { NextResponse } from "next/server";
import { getPrizeCategoriesForOwner } from "@/lib/auth/event-access";
import { getPrizeCategoryOwner } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { matchPrizeCategorySlugs } from "@/lib/prize-category-matching";
import { createAdminClient } from "@/lib/supabase/admin";

// Re-derives standardized_opt_in_prizes for every project from its
// already-stored raw opt_in_prizes text against the current prize_categories
// catalog -- so newly added categories/aliases (or newly hidden slugs) apply
// retroactively to already-imported projects without re-uploading the CSV.
// Scoped to the caller's own events: the admin's unowned events against the
// global catalog, or a user's events against global + their own categories.
export async function POST() {
  try {
    const session = await getSession();
    const ownerUserId = getPrizeCategoryOwner(session);
    if (ownerUserId === undefined) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createAdminClient();

    const eventsQuery = supabase.from("events").select("id");
    const { data: ownedEvents, error: eventsError } = await (ownerUserId
      ? eventsQuery.eq("owner_user_id", ownerUserId)
      : eventsQuery.is("owner_user_id", null));
    if (eventsError) throw eventsError;

    const prizeCategories = await getPrizeCategoriesForOwner(ownerUserId);

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, opt_in_prizes, standardized_opt_in_prizes")
      .in(
        "event_id",
        ownedEvents.map((event) => event.id),
      );

    if (projectsError) {
      console.error(
        "Failed to fetch data for prize track recompute",
        projectsError,
      );
      return NextResponse.json(
        { error: "Failed to fetch prize categories or projects" },
        { status: 500 },
      );
    }

    const sameSlugs = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((slug, i) => slug === sortedB[i]);
    };

    const updates = (projects ?? [])
      .map((project) => ({
        id: project.id,
        next: matchPrizeCategorySlugs(
          project.opt_in_prizes ?? "",
          prizeCategories,
        ),
        current: project.standardized_opt_in_prizes ?? [],
      }))
      .filter((project) => !sameSlugs(project.next, project.current));

    const results = await Promise.all(
      updates.map(({ id, next }) =>
        supabase
          .from("projects")
          .update({ standardized_opt_in_prizes: next })
          .eq("id", id),
      ),
    );

    const failedCount = results.filter((r) => r.error).length;
    if (failedCount > 0) {
      console.error(
        "Failed to update some projects during prize track recompute",
        results.filter((r) => r.error).map((r) => r.error),
      );
    }

    return NextResponse.json({
      updated: updates.length - failedCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
