/** Derive a tiny live badge string for a tile from its app's /console/state. */
import type { ConsoleState, Tile } from "@gcd-arcade/shared";

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function obj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}

/**
 * Best-effort, contract-agnostic summary. Each app's state shape differs, so we
 * probe a few well-known fields and fall back to "online" rather than guessing.
 */
export function summarizeBadge(tile: Tile, state: ConsoleState | undefined, failed = false): string {
  if (!tile.enabled) return "Coming soon";
  if (!tile.online) return "Offline";
  // "···" means "haven't heard back yet" — genuinely still loading. A fetch
  // that actually failed (app manifest says online, but /state 502'd) needs
  // to say so, or it reads as permanently loading rather than the actual
  // "can't reach it right now" it is.
  if (failed) return "Unreachable";
  if (!state) return "···";

  // gcd-social: autonomy phase / awaiting approval
  const phase = (state.phase ?? state.autonomy ?? (obj(state.autonomy) && obj(state.autonomy)!.phase)) as
    | string
    | undefined;
  if (tile.view === "agents" && typeof phase === "string") return phase;

  // gcd-webhook programs: pull the program's bucket from state.programs
  const programs = obj(state.programs);
  if (tile.program && programs) {
    const p = obj(programs[tile.program]);
    if (p) {
      if (num(p.unread) !== undefined && num(p.unread)! > 0) return `${p.unread} unread`;
      if (num(p.pending) !== undefined) return `${p.pending} pending`;
      if (num(p.threads) !== undefined) return `${p.threads} threads`;
      if (num(p.tracked) !== undefined) return `${p.tracked} tracked`;
      if (num(p.total) !== undefined) return `${p.total} total`;
    }
  }

  // attribution: ROAS ticker if present
  const kpis = obj(state.kpis);
  if (kpis && num(kpis.roas) !== undefined) return `ROAS ${num(kpis.roas)!.toFixed(1)}×`;

  // recent event count as a generic liveness hint
  if (Array.isArray(state.recentEvents) && state.recentEvents.length) {
    return `${state.recentEvents.length} events`;
  }
  return "online";
}
