import { slugify } from "@/lib/utils/string-utils";

export type PrizeCategoryMatchInput = {
  slug: string;
  alias_slugs: string[];
};

// Devpost's "Opt-In Prizes" column format varies by event: some prefix every
// entry with "<Sponsor>: " (e.g. "MLH: Best Use of Gemini API", "Deloitte:
// Green AI"), others just list bare prize names with no sponsor info at all
// (e.g. "Best Use of Gemini API"). We only want MLH-sponsored prizes, since
// prize review is scoped to MLH prize tracks -- so entries explicitly
// prefixed with a *different* sponsor are skipped, while both MLH-prefixed
// and un-prefixed entries are treated as MLH-prize candidates.
//
// Note a bare/MLH-prefixed entry is only a *candidate* -- see
// matchPrizeCategorySlugs for the step that decides whether it's actually an
// MLH prize track (i.e. whether it's been configured in prize_categories).
// Devpost joins the list as English prose: "A and B" for two entries and
// "A, B, and C" for three or more, so the last entry arrives as "and C" (or
// "A and B" with no comma at all). A bare " and " can't be split on blindly
// since prize names themselves can contain it ("Best Hardware and IoT Hack"),
// so a mid-entry " and " only splits when what follows looks like the start
// of a new sponsor-prefixed entry ("[MLH] ..." or "MLH: ...").
function splitPrizeList(optInPrizes: string): string[] {
  return optInPrizes
    .split(",")
    .flatMap((entry) =>
      entry
        .trim()
        .replace(/^and\s+/i, "")
        .split(/\s+and\s+(?=\[[^\]]+\]|[^:,]{1,40}:\s)/i),
    )
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function extractMlhCandidateSlugs(optInPrizes: string): string[] {
  if (!optInPrizes.trim()) return [];
  const candidates = new Set<string>();

  splitPrizeList(optInPrizes).forEach((trimmed) => {
    if (!trimmed) return;

    const prefixMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (prefixMatch && !/^mlh$/i.test(prefixMatch[1].trim())) return;

    const name = prefixMatch ? prefixMatch[2].trim() : trimmed;
    const slug = slugify(name);
    if (slug) candidates.add(slug);
  });

  return Array.from(candidates);
}

// A candidate is only an MLH prize track if it's been explicitly configured
// as a prize_categories row -- matched by canonical slug or one of its
// alias_slugs, since the same MLH track is often worded differently across
// events' Devpost exports (e.g. "Best Use of Gemini API" vs "Google Gemini
// API Prize"). Anything else is dropped rather than silently treated as MLH
// just because it happened to be un-prefixed in the CSV.
export function matchPrizeCategorySlugs<T extends PrizeCategoryMatchInput>(
  optInPrizes: string,
  categories: T[],
): string[] {
  const matched = new Set<string>();

  extractMlhCandidateSlugs(optInPrizes).forEach((candidateSlug) => {
    const catalogMatch = categories.find(
      (category) =>
        category.slug === candidateSlug ||
        category.alias_slugs.includes(candidateSlug),
    );
    if (catalogMatch) matched.add(catalogMatch.slug);
  });

  return Array.from(matched);
}
