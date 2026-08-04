import { useEffect, useState } from "react";
import type { ConsoleEvent, ConsoleState, Tile } from "@gcd-arcade/shared";
import { fetchState } from "../lib/bff";
import { useStream } from "../lib/sse";
import { summarizeBadge } from "../lib/badges";
import { iconFor } from "../lib/icons";

/** Best-effort icon for an event row from its `kind` string — ConsoleEvent
 *  carries no icon field, so this pattern-matches the same way badges.ts and
 *  the agents/attribution engines probe loosely-typed feed data. */
function iconIdForKind(kind: string | undefined): string {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("incoming") || k.includes("call")) return "phone-incoming";
  if (k.includes("transcript") || k.includes("file")) return "file-text";
  if (k.includes("fail") || k.includes("error") || k.includes("reject")) return "x-circle";
  if (k.includes("done") || k.includes("complet") || k.includes("success") || k.includes("tagg")) return "check-circle";
  return "layout-grid";
}

/**
 * Generic themed live view used as the foundation default for every tile.
 * Left: a compact snapshot from /console/state. Right: the live event stream.
 * No logic changes from the original — same fetchState + useStream wiring;
 * this is a restyle only.
 */
export function LiveView({ tile }: { tile: Tile }) {
  const [state, setState] = useState<ConsoleState | undefined>();
  const { events, status } = useStream(tile.appId, tile.program);

  useEffect(() => {
    let alive = true;
    const load = () => fetchState(tile.appId).then((s) => alive && setState(s)).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tile.appId]);

  const streamEvents = tile.program ? events.filter((e) => !e.program || e.program === tile.program) : events;

  return (
    <div className="view-body">
      <div className="panel">
        <h3>Snapshot</h3>
        <div className="kpi-row">
          <span>Status</span>
          <b>{summarizeBadge(tile, state)}</b>
        </div>
        <StateSnapshot state={state} program={tile.program} />
      </div>
      <div className="panel">
        <h3>Live activity {status === "open" && <span className="statusdot open" />}</h3>
        {streamEvents.length === 0 ? (
          <div className="empty">
            {status === "error" ? "Stream unavailable — app may be offline." : "Waiting for live events…"}
          </div>
        ) : (
          <div>
            {streamEvents.map((e) => (
              <EventRow key={`${e.appId ?? ""}-${e.id}`} ev={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: ConsoleEvent }) {
  const ts = ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const Icon = iconFor(iconIdForKind(ev.kind));
  return (
    <div className="event-row">
      <span className="row-icon">
        <Icon />
      </span>
      <span className="row-msg">{ev.message ?? ev.kind ?? (ev.program ? `[${ev.program}]` : "")}</span>
      <span className="row-ts">{ts}</span>
    </div>
  );
}

/** Render scalar fields + program buckets from an app's state, generically. */
function StateSnapshot({ state, program }: { state: ConsoleState | undefined; program?: string }) {
  if (!state) return <div className="empty">Loading state…</div>;

  const rows: { k: string; v: string }[] = [];
  const pushScalar = (k: string, v: unknown) => {
    if (v == null) return;
    if (typeof v === "object") return;
    rows.push({ k, v: String(v) });
  };

  // If filtered to a program, prefer that bucket.
  const programs = state.programs as Record<string, unknown> | undefined;
  if (program && programs && typeof programs[program] === "object") {
    const bucket = programs[program] as Record<string, unknown>;
    for (const [k, v] of Object.entries(bucket)) pushScalar(k, v);
  } else {
    for (const [k, v] of Object.entries(state)) {
      if (k === "recentEvents") continue;
      if (k === "kpis" && v && typeof v === "object") {
        for (const [kk, vv] of Object.entries(v as Record<string, unknown>)) pushScalar(kk, vv);
      } else {
        pushScalar(k, v);
      }
    }
  }

  if (rows.length === 0) return null;
  return (
    <div>
      {rows.map((r) => (
        <div className="kpi-row" key={r.k}>
          <span>{r.k}</span>
          <b>{r.v}</b>
        </div>
      ))}
    </div>
  );
}
