import type { Moment } from "./engine";
import { moneyExact } from "./format";

/** Transient celebratory / alert overlay for a trading-desk beat. */
export function AttrMoment({ moment }: { moment: Moment | null }) {
  if (!moment) return null;
  switch (moment.kind) {
    case "match":
      return (
        <div className="attr-moment match" key={moment.seq}>
          <div className="banner">
            💰 MATCH PRINTED{moment.amount !== undefined ? ` · +${moneyExact(moment.amount)}` : ""}
          </div>
        </div>
      );
    case "capi":
      return (
        <div className="attr-moment capi" key={moment.seq}>
          <div className="banner">📡 ORDERS AWAY</div>
        </div>
      );
    case "highroas":
      return (
        <div className="attr-moment highroas" key={moment.seq}>
          <div className="banner">📈 NEW ROAS HIGH</div>
        </div>
      );
    case "failed":
      return (
        <div className="attr-moment failed" key={moment.seq}>
          <div className="banner">🚨 JOB FAILED</div>
        </div>
      );
    default:
      return null;
  }
}
