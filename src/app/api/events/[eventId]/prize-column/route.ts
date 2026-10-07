import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { getSession } from "@/lib/auth/session";
import { matchPrizeCategorySlugs } from "@/lib/prize-category-matching";
import { createClient } from "@/lib/supabase/server";

// Re-points an already-imported event's prize tracks at a different CSV
// column. Some events put the MLH prizes somewhere other than "Opt-In
// Prizes", and every project keeps its original row in csv_row, so this
// re-reads opt_in_prizes from `column` and re-derives
// standardized_opt_in_prizes without re-uploading the CSV.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const session = await getSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { eventId } = await params;
    const body = await request.json().catch(() => null);
    const column = typeof body?.column === "string" ? body.column.trim() : "";

    if (!column) {
      return NextResponse.json(
        { error: "column is required" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const [
      { data: prizeCategories, error: categoriesError },
      { data: projects, error: projectsError },
    ] = await Promise.all([
      supabase.from("prize_categories").select("slug, alias_slugs"),
      supabase.from("projects").select("id, csv_row").eq("event_id", eventId),
    ]);

    if (categoriesError || projectsError) {
      console.error(
        "Failed to fetch data for prize column remap",
        categoriesError ?? projectsError,
      );
      return NextResponse.json(
        { error: "Failed to fetch prize categories or projects" },
        { status: 500 },
      );
    }

    const updates = (projects ?? []).map((project) => {
      const csvRow =
        project.csv_row && typeof project.csv_row === "object"
          ? (project.csv_row as Record<string, unknown>)
          : {};
      const raw = csvRow[column];
      const optInPrizes = typeof raw === "string" ? raw.trim() : "";
      return {
        id: project.id,
        opt_in_prizes: optInPrizes,
        standardized_opt_in_prizes: matchPrizeCategorySlugs(
          optInPrizes,
          prizeCategories ?? [],
        ),
      };
    });

    const results = await Promise.all(
      updates.map(({ id, ...fields }) =>
        supabase.from("projects").update(fields).eq("id", id),
      ),
    );

    const failedCount = results.filter((r) => r.error).length;
    if (failedCount > 0) {
      console.error(
        "Failed to update some projects during prize column remap",
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
