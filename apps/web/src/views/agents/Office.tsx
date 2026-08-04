import { CAST, type Character } from "./cast";
import type { OfficeState } from "./engine";
import { iconFor } from "../../lib/icons";

/** Plain "Team" list: one row per agent, with the engine's per-agent status
 *  text — this replaces the desks/sprites office floor. Same underlying
 *  data (office.agents / office.agentMsg), presentation only. */
export function TeamList({ office }: { office: OfficeState }) {
  return (
    <div className="panel">
      <h3>Team</h3>
      {CAST.map((c) => (
        <AgentRow key={c.id} ch={c} office={office} />
      ))}
    </div>
  );
}

function AgentRow({ ch, office }: { ch: Character; office: OfficeState }) {
  const status = office.agents[ch.id] ?? "idle";
  const msg = status === "working" ? office.agentMsg[ch.id] : undefined;
  const statusText = msg ?? (status === "done" ? "Done" : status === "working" ? "Working" : "Idle");
  const Icon = iconFor(ch.icon);
  return (
    <div className="event-row">
      <span className="row-icon">
        <Icon />
      </span>
      <span className="row-msg wrap">
        <span style={{ fontWeight: 600 }}>{ch.name}</span>{" "}
        <span style={{ color: "var(--text-muted)" }}>· {ch.role}</span>
        <span className="row-sub">{statusText}</span>
      </span>
    </div>
  );
}
