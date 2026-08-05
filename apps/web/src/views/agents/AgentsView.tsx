import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { AgencyEngine, type OfficeState } from "./engine";
import { TeamList } from "./Office";
import { StatRow } from "./Hud";
import { PostStrip } from "./Moments";

/**
 * GCD-SOCIAL "Content Studio" — a plain, light presentation of the agency
 * engine's live state. The engine reduces the SSE feed into `OfficeState`
 * (including the post-card history in `office.posts`); this component owns
 * the React glue only (no sound, no game flourishes).
 */
export function AgentsView({ tile }: { tile: Tile }) {
  const { events } = useStream(tile.appId);

  const engineRef = useRef<AgencyEngine | null>(null);
  const [office, setOffice] = useState<OfficeState>(() => {
    const engine = new AgencyEngine(() => {});
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
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflowY: "auto", overflowX: "hidden" }}>
      <div>
        <StatRow office={office} />
        <TeamList office={office} />
        <div style={{ height: 24 }} />
        <PostStrip posts={office.posts} />
      </div>
    </div>
  );
}
