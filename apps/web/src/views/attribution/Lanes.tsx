import type { Lane, TerminalState } from "./engine";

const STAT_LABEL: Record<Lane["status"], string> = {
  idle: "idle",
  active: "running",
  completed: "done",
  failed: "failed",
};

/** The 5 BullMQ jobs as neon execution lanes. */
export function Lanes({ s }: { s: TerminalState }) {
  return (
    <div className="attr-panel">
      <h4>Execution Lanes</h4>
      <div className="lanes">
        {s.lanes.map((l) => (
          <div className={`lane ${l.status}`} key={l.key}>
            <span className="dot" />
            <div className="name">
              {l.label}
              {l.status === "active" && (
                <div className="pbar">
                  <i style={{ width: `${Math.max(8, l.progress)}%` }} />
                </div>
              )}
            </div>
            <span className="stat">{STAT_LABEL[l.status]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
