/**
 * The agency cast: maps GCD-SOCIAL's technical agent ids to named characters
 * with a role and a Lucide icon id. Order follows the brief's real journey
 * (analytics → … → posting).
 *
 * Rename freely — only `id` must match the feed's agent ids.
 */
export interface Character {
  id: string;
  name: string;
  role: string;
  icon: string;
}

export const AGENCY_NAME = "GCD Social";
export const AGENCY_TAGLINE = "Content studio";

export const CAST: Character[] = [
  { id: "analytics", name: "Dana", role: "Analytics", icon: "bar-chart-3" },
  { id: "copywriter", name: "Remy", role: "Copywriting", icon: "pen-tool" },
  { id: "image", name: "Pixel", role: "Art direction", icon: "wand-2" },
  { id: "hashtag-seo-timing", name: "Tess", role: "SEO", icon: "search" },
  { id: "brand-compliance-critic", name: "Cole", role: "Critic", icon: "clipboard-check" },
  { id: "platform-formatter", name: "Fran", role: "Formatting", icon: "layout-template" },
  { id: "posting", name: "Posty", role: "Publishing", icon: "send" },
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
