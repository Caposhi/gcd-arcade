/**
 * The agency cast: maps GCD-SOCIAL's technical agent ids to named characters
 * with a role, avatar, and accent color. Desk order follows the brief's real
 * journey (analytics → … → posting), so the project token tours left-to-right.
 *
 * Rename freely — only `id` must match the feed's agent ids.
 */
export interface Character {
  id: string;
  name: string;
  role: string;
  emoji: string;
  color: string;
}

export const AGENCY_NAME = "GCD SOCIAL";
export const AGENCY_TAGLINE = "CREATIVE GARAGE";

export const CAST: Character[] = [
  { id: "analytics", name: "Dana", role: "Analyst", emoji: "📊", color: "#36c2ff" },
  { id: "copywriter", name: "Remy", role: "Copywriter", emoji: "✍️", color: "#ffce4d" },
  { id: "image", name: "Pixel", role: "Art Director", emoji: "🎨", color: "#ff6ad5" },
  { id: "hashtag-seo-timing", name: "Tess", role: "SEO & Timing", emoji: "🏷️", color: "#7cf08a" },
  { id: "brand-compliance-critic", name: "Cole", role: "Brand Critic", emoji: "🧐", color: "#ff8a5c" },
  { id: "platform-formatter", name: "Fran", role: "Formatter", emoji: "🧩", color: "#b69cff" },
  { id: "posting", name: "Posty", role: "Publisher", emoji: "🚀", color: "#ff5470" },
];

export const CAST_BY_ID: Record<string, Character> = Object.fromEntries(CAST.map((c) => [c.id, c]));

/** The ordered pipeline of agent ids the brief flows through. */
export const PIPELINE = CAST.map((c) => c.id);

/** Resolve an agent id to a character, tolerating unknown/aliased ids. */
export function characterFor(agentId: string | undefined): Character | undefined {
  if (!agentId) return undefined;
  if (CAST_BY_ID[agentId]) return CAST_BY_ID[agentId];
  // tolerate partial/aliased ids from the feed (e.g. "seo", "hashtag")
  const lower = agentId.toLowerCase();
  return CAST.find((c) => lower.includes(c.id) || c.id.includes(lower) || lower.includes(c.role.toLowerCase()));
}
