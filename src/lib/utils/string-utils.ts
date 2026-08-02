/**
 * Converts a string to title case (first letter capitalized, rest lowercase)
 * @param str - The string to convert
 * @returns The title-cased string
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Kebab-cases free text into a slug (e.g. "Best Use of Gemini API" ->
 * "best-use-of-gemini-api").
 * @param text - The text to slugify
 * @returns The slugified string
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
