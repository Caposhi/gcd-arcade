import type { TerminalState } from "./engine";
import { moneyExact, timeText } from "./format";

/** "Recent matches" — amount, description, timestamp. Filtered to the
 *  `match` prints from engine.ts's tape (CAPI sends and failures are already
 *  visible as job status in the Lanes list, so this list stays focused on
 *  matches per the mockup). */
export function Tape({ s }: { s: TerminalState }) {
  const matches = s.prints.filter((p) => p.kind === "match");
  return (
    <div className="panel">
      <h3>Recent matches</h3>
      {matches.length === 0 ? (
        <div className="empty">Waiting for the next match…</div>
      ) : (
        matches.map((p) => (
          <div className="event-row" key={p.id}>
            <span className="row-amt">{p.amount !== undefined ? `+${moneyExact(p.amount)}` : "—"}</span>
            <span className="row-msg">{p.text}</span>
            <span className="row-ts">{timeText(p.at)}</span>
          </div>
        ))
      )}
    </div>
  );
}
