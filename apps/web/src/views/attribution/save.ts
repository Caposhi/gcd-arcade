/**
 * Light "game flourish" progress for the trading desk, persisted client-side
 * (the hub stays stateless). Tracks the best ROAS ever seen and the longest
 * clean run (consecutive completed jobs without a failure).
 */
export interface DeskSave {
  bestRoas: number;
  cleanStreak: number; // current consecutive job:completed without a failure
  bestStreak: number;
}

const KEY = "gcd-arcade:attribution:save";
const EMPTY: DeskSave = { bestRoas: 0, cleanStreak: 0, bestStreak: 0 };

export function loadDeskSave(): DeskSave {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<DeskSave>) };
  } catch {
    /* ignore */
  }
  return { ...EMPTY };
}

export function persistDeskSave(save: DeskSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* ignore */
  }
}

/** A flavor rank derived from the best ROAS achieved. */
export function deskRank(bestRoas: number): string {
  if (bestRoas >= 5) return "PARTNER";
  if (bestRoas >= 4) return "VP";
  if (bestRoas >= 3) return "SENIOR";
  if (bestRoas >= 2) return "TRADER";
  if (bestRoas >= 1) return "ANALYST";
  return "ROOKIE";
}
