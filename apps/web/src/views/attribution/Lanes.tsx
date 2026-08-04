import type { Lane, LaneStatus, TerminalState } from "./engine";

const STATUS_LABEL: Record<LaneStatus, string> = {
  idle: "Idle",
  active: "Running",
  completed: "Done",
  failed: "Failed",
};
const STATUS_COLOR: Record<LaneStatus, string> = {
  idle: "var(--gray-400)",
  active: "var(--royal-blue)",
  completed: "var(--success)",
  failed: "var(--danger)",
};

/** The 5 BullMQ jobs as a plain list: name, status label, thin progress bar.
 *  Same lanes from engine.ts, restyle only. */
export function Lanes({ s }: { s: TerminalState }) {
  return (
    <div className="panel">
      <h3>Automation jobs</h3>
      {s.lanes.map((l) => (
        <LaneRow key={l.key} lane={l} />
      ))}
    </div>
  );
}

function LaneRow({ lane }: { lane: Lane }) {
  const color = STATUS_COLOR[lane.status];
  const width = lane.status === "completed" ? 100 : lane.status === "idle" ? 0 : Math.max(6, lane.progress);
  return (
    <div className="job-row">
      <div className="job-head">
        <span className="job-name">{lane.label}</span>
        <span className="job-status" style={{ color }}>
          {STATUS_LABEL[lane.status]}
        </span>
      </div>
      <div className="job-bar">
        <i style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}
