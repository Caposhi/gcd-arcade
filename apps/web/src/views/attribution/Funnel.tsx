import type { TerminalState } from "./engine";

/** Leads → Matched → Attributed → Conversions as horizontal bar rows, width
 *  proportional to the largest stage's value. Same funnel data from
 *  engine.ts, restyle only. */
export function FunnelRow({ s }: { s: TerminalState }) {
  const f = s.funnel;
  const steps = [
    { label: "Leads", n: f.leads },
    { label: "Matched", n: f.matched },
    { label: "Attributed", n: f.attributed },
    { label: "Conversions", n: f.conversions },
  ];
  const max = Math.max(1, ...steps.map((x) => x.n ?? 0));
  return (
    <div className="panel">
      <h3>Funnel</h3>
      {steps.map((st) => (
        <div className="funnel-row" key={st.label}>
          <span className="stage">{st.label}</span>
          <span className="bar-track">
            <i style={{ width: `${Math.max(4, ((st.n ?? 0) / max) * 100)}%` }} />
          </span>
          <span className="stage-value">{st.n ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
