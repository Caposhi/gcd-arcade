import type { TerminalState } from "./engine";

/** Leads → Matched → Attributed → Conversions funnel + data-quality gauges. */
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
    <div className="attr-panel">
      <h4>Pipeline Volume & Data Quality</h4>
      <div className="fgrow">
        <div className="funnel">
          {steps.map((st) => (
            <div className="step" key={st.label}>
              <span style={{ color: "#7fa0d8" }}>{st.label}</span>
              <span className="bar" style={{ width: `${((st.n ?? 0) / max) * 100}%` }} />
              <span className="num">{st.n ?? "—"}</span>
            </div>
          ))}
        </div>
        <div className="gauges">
          <Gauge label="MATCH RATE" pct={s.dataQuality.matchRate} />
          <Gauge label="CAPI ACCEPT" pct={s.dataQuality.capiAcceptance} />
        </div>
      </div>
    </div>
  );
}

function Gauge({ label, pct }: { label: string; pct?: number }) {
  const v = pct ?? 0;
  const color = v >= 80 ? "#2bd576" : v >= 50 ? "#ffcf4d" : "#ff3b6b";
  const ring =
    pct === undefined
      ? "conic-gradient(#2a3a5e 0 100%)"
      : `conic-gradient(${color} ${v * 3.6}deg, rgba(255,255,255,0.08) 0)`;
  return (
    <div className="gauge">
      <div className="ring" style={{ background: ring }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#0a1024",
            display: "grid",
            placeItems: "center",
          }}
        >
          {pct === undefined ? "—" : `${v}%`}
        </div>
      </div>
      <div className="lbl">{label}</div>
    </div>
  );
}
