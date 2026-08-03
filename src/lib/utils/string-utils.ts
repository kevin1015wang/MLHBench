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

/**
 * Checks whether a string is a well-formed http(s) URL, assuming an
 * `https://` prefix if the scheme is omitted (e.g. "github.com/foo/bar").
 * @param value - The string to check
 * @returns Whether the string is a valid http(s) URL
 */
export function isUrl(value: string): boolean {
  if (!value.trim()) return false;
  const prefixed = value.startsWith("http") ? value : `https://${value}`;
  try {
    const url = new URL(prefixed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
