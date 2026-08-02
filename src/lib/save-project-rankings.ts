import { createClient } from "@/lib/supabase/client";

// Rewrites the full rank order for a prize category: deletes the existing
// rows for it and reinserts the given project IDs as rank 1..N. Simpler and
// safer than diffing individual rank changes, and cheap enough given this
// only runs once per drag-and-drop reorder.
export async function saveProjectRankings(
  eventId: string,
  prizeCategoryId: string,
  orderedProjectIds: string[],
) {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("project_rankings")
    .delete()
    .eq("event_id", eventId)
    .eq("prize_category_id", prizeCategoryId);
  if (deleteError) throw deleteError;

  if (orderedProjectIds.length === 0) return;

  const rows = orderedProjectIds.map((projectId, index) => ({
    event_id: eventId,
    project_id: projectId,
    prize_category_id: prizeCategoryId,
    rank: index + 1,
  }));

  const { error: insertError } = await supabase
    .from("project_rankings")
    .insert(rows);
  if (insertError) throw insertError;
}
