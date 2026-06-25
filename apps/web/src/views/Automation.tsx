import { useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { LiveView } from "./LiveView";
import { sfx } from "../lib/sound";
import { useSettings } from "../lib/settings";

/**
 * Automation Server: a control-room sub-grid of the remaining gcd-webhook
 * programs. Picking one drills into its program-filtered live view.
 */
export function Automation({ tile }: { tile: Tile }) {
  const { sound } = useSettings();
  const [open, setOpen] = useState<Tile | null>(null);
  const children = tile.children ?? [];

  if (open) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "12px 28px" }}>
          <button
            className="btn ghost"
            onClick={() => {
              if (sound) sfx.back();
              setOpen(null);
            }}
          >
            ← All programs
          </button>
          <span style={{ marginLeft: 14, fontWeight: 700 }}>
            {open.icon} {open.name}
          </span>
        </div>
        <LiveView tile={open} />
      </div>
    );
  }

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr" }}>
      <div className="panel">
        <h3>Programs</h3>
        {children.length === 0 ? (
          <div className="empty">No sub-programs reported.</div>
        ) : (
          <div className="subgrid">
            {children.map((c) => (
              <div
                className="subcard"
                key={c.id}
                onClick={() => {
                  if (sound) sfx.enter();
                  setOpen(c);
                }}
              >
                <div className="ic">{c.icon}</div>
                <div className="nm">{c.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
