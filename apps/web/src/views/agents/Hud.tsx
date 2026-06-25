import { AGENCY_NAME, AGENCY_TAGLINE } from "./cast";
import type { OfficeState } from "./engine";

/** The tycoon HUD: agency sign, Level/XP, reputation, buzz, posts, streak,
 *  autonomy mode, and platform chips with token-health dots. */
export function Hud({ office }: { office: OfficeState }) {
  const m = office.meters;
  const xpPct = Math.round((m.xpInto / m.xpSpan) * 100);
  return (
    <div className="agency-hud">
      <div className="agency-sign">
        <span className="nm">{AGENCY_NAME}</span>
        <span className="tg">{AGENCY_TAGLINE}</span>
      </div>

      <div className="level-badge" title={`Level ${m.level}`}>
        {m.level}
      </div>
      <div className="meter">
        <span className="lbl">XP</span>
        <div className="xpbar">
          <i style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <Stat label="Reputation" value={`${m.reputation}%`} />
      <Stat label="Buzz" value={m.buzz.toLocaleString()} />
      <Stat label="Posts Shipped" value={m.posts.toLocaleString()} />
      <Stat label="Streak" value={`🔥 ${m.streak}`} />

      <div className="spacer" />

      <div className="mode-badge" title="Autonomy mode">
        {office.mode}
      </div>
      <div className="chips">
        {office.platforms.map((p) => (
          <span className={`chip ${p.active ? "" : "off"}`} key={p.id}>
            <span className={`healthdot ${healthClass(office.tokenHealth, p.id)}`} />
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="meter">
      <span className="lbl">{label}</span>
      <span className="val">{value}</span>
    </div>
  );
}

/** Token health currently reflects the IG token; show it on the IG chip. */
function healthClass(health: OfficeState["tokenHealth"], platformId: string): string {
  const isInstagram = /insta|ig/i.test(platformId);
  if (!isInstagram) return "ok";
  return health === "unknown" ? "" : health;
}
