/**
 * Converts a string to a URL-friendly slug.
 * Example: "Frieren: Beyond Journey's End Season 2" -> "frieren-beyond-journeys-end-season-2"
 */
export function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/['']/g, '')           // Remove apostrophes
        .replace(/[^a-z0-9]+/g, '-')    // Replace non-alphanumerics with hyphens
        .replace(/^-+|-+$/g, '')        // Trim leading/trailing hyphens
        .substring(0, 50);              // Limit length
}
