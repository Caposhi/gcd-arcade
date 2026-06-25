import { CAST, PIPELINE, type Character } from "./cast";
import type { OfficeState } from "./engine";

/** Desk coordinates on the floor (percent), in pipeline order so the project
 *  folder snakes left-to-right through the agency. */
const DESK_POS: Record<string, { x: number; y: number }> = {
  analytics: { x: 11, y: 34 },
  copywriter: { x: 25, y: 66 },
  image: { x: 39, y: 33 },
  "hashtag-seo-timing": { x: 53, y: 66 },
  "brand-compliance-critic": { x: 67, y: 33 },
  "platform-formatter": { x: 81, y: 66 },
  posting: { x: 92, y: 38 },
};

export function Office({ office }: { office: OfficeState }) {
  const { brief, running } = office;
  const activeId = brief?.activeAgent;
  const tokenPos = activeId ? DESK_POS[activeId] : undefined;
  const progress = brief ? Math.round(((brief.phaseIndex + (running ? 0.5 : 1)) / PIPELINE.length) * 100) : 0;

  return (
    <div className="floor">
      {/* idle ambience props */}
      <span className="prop" style={{ left: "4%", bottom: "8%" }}>🪴</span>
      <span className="prop" style={{ right: "3%", top: "12%", animationDelay: "1.2s" }}>🪴</span>
      <span className="prop" style={{ left: "47%", top: "6%", animationDelay: "0.6s" }}>☕</span>

      {!running && (
        <div className="idle-banner">
          {brief?.status === "published"
            ? "✅ POST SHIPPED — studio idle"
            : brief?.status === "escalated"
              ? "⚠️ AWAITING HUMAN — studio idle"
              : "STUDIO IDLE — waiting for the next brief"}
        </div>
      )}

      {CAST.map((c) => (
        <Desk key={c.id} ch={c} office={office} />
      ))}

      {/* the traveling project folder */}
      {brief && tokenPos && running && (
        <div
          className={`token ${brief.status === "awaiting" ? "awaiting" : ""}`}
          style={{ left: `${tokenPos.x}%`, top: `${tokenPos.y - 18}%` }}
        >
          <div
            className="thumb"
            style={brief.imageUrl ? { backgroundImage: `url(${brief.imageUrl})` } : undefined}
          >
            {brief.imageUrl ? "" : "🖼️"}
          </div>
          {brief.caption && <div className="cap">{brief.caption}</div>}
          <div className="pbar">
            <i style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* backlog inbox */}
      <div className="inbox-tray">
        <div className="stack">{office.queueCount > 0 ? "🗂️" : "📭"}</div>
        <div className="lbl">{office.queueCount > 0 ? `${office.queueCount} in queue` : "inbox empty"}</div>
      </div>
    </div>
  );
}

function Desk({ ch, office }: { ch: Character; office: OfficeState }) {
  const status = office.agents[ch.id] ?? "idle";
  const pos = DESK_POS[ch.id];
  const msg = status === "working" ? office.agentMsg[ch.id] : undefined;
  return (
    <div
      className={`desk ${status}`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, ["--accent" as string]: ch.color }}
    >
      <div className="worker" style={{ boxShadow: status === "working" ? `0 0 22px ${ch.color}66` : undefined }}>
        {msg && <div className="bubble">{msg}</div>}
        <span className="statusring" />
        {ch.emoji}
        {status === "done" && <span className="donecheck">✓</span>}
      </div>
      <div className="deskdesktop" />
      <div className="nameplate">
        {ch.name}
        <span className="role">{ch.role}</span>
      </div>
    </div>
  );
}
