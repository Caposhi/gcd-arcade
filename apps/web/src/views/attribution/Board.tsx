import type { TerminalState } from "./engine";
import { money, moneyExact, roasText } from "./format";

/** 4 plain stat cards — replaces the scrolling ticker tape + neon ROAS hero
 *  + sparkline. Same kpis from engine.ts, restyle only. */
export function StatBoard({ s }: { s: TerminalState }) {
  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="lbl">Ad spend</div>
        <div className="val">{money(s.kpis.spend)}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">Revenue</div>
        <div className="val">{money(s.kpis.revenue)}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">ROAS</div>
        <div className="val accent">{roasText(s.kpis.roas)}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">CAC</div>
        <div className="val">{moneyExact(s.kpis.cac)}</div>
      </div>
    </div>
  );
}
