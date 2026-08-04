import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { CAST_BY_ID } from "./cast";
import { AgencyEngine, type Moment, type OfficeState } from "./engine";
import { TeamList } from "./Office";
import { StatRow } from "./Hud";
import { ActivityList, type ActivityItem } from "./Moments";

let activitySeq = 0;

/** Turn a dramatic beat into a plain activity-log line. The critic always
 *  sends work back to the copywriter (engine.ts rewinds phaseIndex to
 *  "copywriter" on FAIL), so naming both agents here reflects how the
 *  pipeline actually works, not a guess. */
function describeMoment(m: Moment, office: OfficeState): string | null {
  const critic = CAST_BY_ID["brand-compliance-critic"]?.name ?? "The critic";
  const writer = CAST_BY_ID["copywriter"]?.name ?? "the copywriter";
  switch (m.kind) {
    case "published":
      return office.brief?.caption ? `Post published — "${office.brief.caption}"` : "Post published";
    case "stamp":
      return `${critic} approved the draft`;
    case "fail":
      return `${critic} sent ${writer}'s draft back for revision`;
    case "escalated":
      return "Brief escalated for human review";
    default:
      return null; // "work" (soft tick) and "levelup" (dropped game meter) — no log line
  }
}

function iconForMoment(kind: Moment["kind"]): string {
  switch (kind) {
    case "published":
      return "check-circle";
    case "fail":
      return "x-circle";
    case "escalated":
      return "x-circle";
    default:
      return "check-circle";
  }
}

/**
 * GCD-SOCIAL "Content Studio" — a plain, light presentation of the agency
 * engine's live state. The engine reduces the SSE feed into `OfficeState`;
 * this component owns the React glue only (no sound, no game flourishes).
 */
export function AgentsView({ tile }: { tile: Tile }) {
  const { events } = useStream(tile.appId);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const onMomentRef = useRef<(m: Moment, office: OfficeState) => void>(() => {});
  onMomentRef.current = (m, office) => {
    const msg = describeMoment(m, office);
    if (!msg) return;
    setActivity((prev) =>
      [{ id: ++activitySeq, icon: iconForMoment(m.kind), msg, at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...prev].slice(0, 12)
    );
  };

  const engineRef = useRef<AgencyEngine | null>(null);
  const [office, setOffice] = useState<OfficeState>(() => {
    const engine = new AgencyEngine((m) => onMomentRef.current(m, engineRef.current!.getState()));
    engineRef.current = engine;
    return engine.getState();
  });

  // Periodic state snapshot (queue counts, autonomy mode, platforms, health).
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchState(tile.appId)
        .then((s) => {
          if (!alive) return;
          engineRef.current!.ingestState(s);
          // Seed from the authoritative recent-event history so the view
          // reflects the latest brief even if the live stream came up late or
          // replayed only partially. Old events update visuals, not the log.
          if (Array.isArray(s.recentEvents)) engineRef.current!.ingestEvents(s.recentEvents);
          setOffice(engineRef.current!.getState());
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tile.appId]);

  // Feed new SSE events into the engine.
  useEffect(() => {
    if (!events.length) return;
    engineRef.current!.ingestEvents(events);
    setOffice(engineRef.current!.getState());
  }, [events]);

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflow: "auto" }}>
      <div>
        <StatRow office={office} />
        <div className="two-col">
          <TeamList office={office} />
          <ActivityList items={activity} />
        </div>
      </div>
    </div>
  );
}
