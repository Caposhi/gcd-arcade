import type { TerminalState } from "./engine";
import { moneyExact, timeText } from "./format";

/** The "tape" — attribution matches, CAPI sends, and failures printing live. */
export function Tape({ s }: { s: TerminalState }) {
  return (
    <div className="attr-tape">
      <h4>▸ Tape · Matches & Conversions</h4>
      {s.prints.length === 0 ? (
        <div className="empty-tape">Quiet market — waiting for the next match to print…</div>
      ) : (
        <div className="tape-rows">
          {s.prints.map((p) => (
            <div className={`print ${p.kind}`} key={p.id}>
              {p.amount !== undefined && <span className="amt">+{moneyExact(p.amount)}</span>}
              {p.kind === "capi" ? (p.accepted ? "✓ " : "✗ ") : ""}
              {p.text}
              <span className="when">{timeText(p.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
