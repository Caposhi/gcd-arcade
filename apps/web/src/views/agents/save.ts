/**
 * The "save file" — client-side progress persisted in localStorage so the
 * agency levels up across visits. The hub itself stays stateless; this lives
 * only in the browser and is advanced by real cumulative counts from the feed.
 */
export interface AgencySave {
  lifetimePublished: number; // best-known total posts shipped
  xp: number;
  passCount: number; // critic PASS verdicts seen
  verdictCount: number; // total critic verdicts seen
  streak: number; // consecutive publishes without an escalation
  bestStreak: number;
  lastPublishedAt: string | null;
}

const KEY = "gcd-arcade:agents:save";

const EMPTY: AgencySave = {
  lifetimePublished: 0,
  xp: 0,
  passCount: 0,
  verdictCount: 0,
  streak: 0,
  bestStreak: 0,
  lastPublishedAt: null,
};

export function loadSave(): AgencySave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<AgencySave>) };
  } catch {
    /* ignore */
  }
  return { ...EMPTY };
}

export function persistSave(save: AgencySave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

/** XP needed to reach a given level (gentle quadratic curve). */
export function xpForLevel(level: number): number {
  return Math.round(40 * level * level);
}

export function levelFromXp(xp: number): { level: number; into: number; span: number } {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, into: xp - base, span: Math.max(1, next - base) };
}

/** XP awarded per shipped post. */
export const XP_PER_POST = 100;
