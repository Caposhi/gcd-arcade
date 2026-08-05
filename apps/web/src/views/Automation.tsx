import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { ConsoleState, Tile } from "@gcd-arcade/shared";
import { LiveView } from "./LiveView";
import { ProjectionsView } from "./qbo/ProjectionsView";
import { AppIcon } from "../lib/icons";
import { fetchState } from "../lib/bff";
import { summarizeBadge } from "../lib/badges";

/** Drill-in body for a sub-program: bespoke worlds route here as they're
 *  redesigned (see QBO_HUB_BESPOKE_VIEW in the BFF's tiles.ts); everything
 *  else still falls back to the generic themed live view. */
function ChildBody({ tile }: { tile: Tile }) {
  switch (tile.view) {
    case "projections":
      return <ProjectionsView tile={tile} />;
    default:
      return <LiveView tile={tile} />;
  }
}

/**
 * Automation Server: a control-room sub-grid of the remaining gcd-webhook
 * programs. Picking one drills into its program-filtered live view. Same
 * drill-down logic as before — restyle only, plus fetching the parent app's
 * state so each sub-card's badge can show a live count (per the handoff:
 * "still fine to show live counts here ... this is one level in, not the
 * home screen").
 */
export function Automation({ tile }: { tile: Tile }) {
  const [open, setOpen] = useState<Tile | null>(null);
  const [state, setState] = useState<ConsoleState | undefined>();
  const [stateFailed, setStateFailed] = useState(false);
  const children = tile.children ?? [];

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchState(tile.appId)
        .then((s) => {
          if (!alive) return;
          setState(s);
          setStateFailed(false);
        })
        .catch(() => alive && setStateFailed(true));
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tile.appId]);

  if (open) {
    return (
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 28px" }}>
          <button className="iconbtn" title="All programs" onClick={() => setOpen(null)}>
            <ChevronLeft />
          </button>
          <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{open.name}</span>
        </div>
        <ChildBody tile={open} />
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
              <div className="subcard" key={c.id} onClick={() => setOpen(c)}>
                <div className="ic">
                  <AppIcon tileId={c.id} />
                </div>
                <div className="nm">{c.name}</div>
                <div className="badge">{summarizeBadge(c, state, stateFailed)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
