import type { TerminalState } from "./engine";
import { money, moneyExact, roasText, pctText, dir, dirInverted } from "./format";

const ARROW = { up: "▲", down: "▼", flat: "·" } as const;

/** The scrolling KPI ticker tape. Doubled so the marquee loops seamlessly. */
export function Ticker({ s }: { s: TerminalState }) {
  const items = [
    { k: "SPEND", v: money(s.kpis.spend), d: dirInverted(s.kpis.spend, s.prevKpis.spend) },
    { k: "REVENUE", v: money(s.kpis.revenue), d: dir(s.kpis.revenue, s.prevKpis.revenue) },
    { k: "ROAS", v: roasText(s.kpis.roas), d: dir(s.kpis.roas, s.prevKpis.roas) },
    { k: "CAC", v: moneyExact(s.kpis.cac), d: dirInverted(s.kpis.cac, s.prevKpis.cac) },
    { k: "MATCH", v: pctText(s.dataQuality.matchRate), d: "flat" as const },
    { k: "CAPI", v: pctText(s.dataQuality.capiAcceptance), d: "flat" as const },
    { k: "BEST ROAS", v: roasText(s.meters.bestRoas || undefined), d: "flat" as const },
  ];
  const row = [...items, ...items];
  return (
    <div className="attr-ticker">
      <span className="tag">LIVE</span>
      <div className="ticker-track">
        {row.map((it, i) => (
          <span className={`tick ${it.d}`} key={i}>
            <span className="k">{it.k}</span>
            <span className="v">{it.v}</span>
            <span className={`arrow ${it.d}`}>{ARROW[it.d]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** ROAS hero + KPI tiles + a ROAS sparkline. */
export function IndexBoard({ s, pulse }: { s: TerminalState; pulse: boolean }) {
  return (
    <div className="attr-panel">
      <div className="indexboard">
        <div className="roas-hero">
          <span className="lbl">ROAS</span>
          <span className={`big ${pulse ? "pulse" : ""}`}>{roasText(s.kpis.roas)}</span>
          <span className="rank">
            DESK RANK · {s.meters.rank} · BEST {roasText(s.meters.bestRoas || undefined)}
          </span>
        </div>
        <div>
          <div className="kpi-tiles">
            <Tile k="SPEND (30d)" v={money(s.kpis.spend)} />
            <Tile k="REVENUE (30d)" v={money(s.kpis.revenue)} />
            <Tile k="CAC" v={moneyExact(s.kpis.cac)} />
          </div>
          <Sparkline data={s.roasHistory} />
        </div>
      </div>
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="kpi-tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <svg className="spark" viewBox="0 0 100 46" preserveAspectRatio="none" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 44 - ((v - min) / span) * 40;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className="spark" viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="#36e0ff" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
