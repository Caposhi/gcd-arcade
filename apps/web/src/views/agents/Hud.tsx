import type { OfficeState } from "./engine";

/**
 * A row of plain stat cards, replacing the tycoon HUD (Level/XP/Reputation/
 * Buzz meter). Maps what's real from the engine:
 *  - Posts shipped / Streak: save.ts's cumulative counters (lifetime, not
 *    "this week" — the mockup's numbers were illustrative; labeled plainly
 *    here rather than claiming a per-week figure the engine doesn't track).
 *  - Approval rate: engine.ts's `reputation`, computed from tracked
 *    critic:verdict PASS/FAIL counts — this is the real field the handoff's
 *    open item asked about.
 *  - Engagement: there's no live engagement number in the feed yet (only
 *    `buzz`, a synthetic game score) — per the handoff, flagged as a
 *    pending-metric placeholder rather than invented.
 */
export function StatRow({ office }: { office: OfficeState }) {
  const m = office.meters;
  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="lbl">Posts shipped</div>
        <div className="val">{m.posts.toLocaleString()}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">Approval rate</div>
        <div className="val">{m.reputation}%</div>
      </div>
      <div className="stat-card">
        <div className="lbl">Streak</div>
        <div className="val">{m.streak}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">Engagement</div>
        <div className="val muted">No live metric yet</div>
      </div>
    </div>
  );
}
