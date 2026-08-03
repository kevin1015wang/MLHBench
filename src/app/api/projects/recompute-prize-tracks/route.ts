import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { matchPrizeCategorySlugs } from "@/lib/prize-category-matching";
import { createClient } from "@/lib/supabase/server";

// Re-derives standardized_opt_in_prizes for every project from its
// already-stored raw opt_in_prizes text against the current prize_categories
// catalog -- so newly added categories/aliases (or newly hidden slugs) apply
// retroactively to already-imported projects without re-uploading the CSV.
export async function POST() {
  try {
    const session = await getSession();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const [
      { data: prizeCategories, error: categoriesError },
      { data: projects, error: projectsError },
    ] = await Promise.all([
      supabase.from("prize_categories").select("slug, alias_slugs"),
      supabase
        .from("projects")
        .select("id, opt_in_prizes, standardized_opt_in_prizes"),
    ]);

    if (categoriesError || projectsError) {
      console.error(
        "Failed to fetch data for prize track recompute",
        categoriesError ?? projectsError,
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
          prizeCategories ?? [],
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
