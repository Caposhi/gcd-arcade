import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { AttributionEngine, type Moment, type TerminalState } from "./engine";
import { StatBoard } from "./Board";
import { Lanes } from "./Lanes";
import { FunnelRow } from "./Funnel";
import { Tape } from "./Tape";

/**
 * Attribution rendered as a plain trading desk. The engine reduces the
 * BullMQ SSE feed + state snapshot into terminal state; this owns the React
 * glue only — no sound, no game flourishes (a failed job's --danger-colored
 * row in Lanes is enough signal on its own, per the handoff).
 */
export function AttributionView({ tile }: { tile: Tile }) {
  const { events } = useStream(tile.appId);

  const engineRef = useRef<AttributionEngine | null>(null);
  const [term, setTerm] = useState<TerminalState>(() => {
    const engine = new AttributionEngine((_m: Moment) => {});
    engineRef.current = engine;
    return engine.getState();
  });

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchState(tile.appId)
        .then((st) => {
          if (!alive) return;
          engineRef.current!.ingestState(st);
          // Seed from recent-event history so the desk reflects the latest
          // activity even if the stream came up late.
          if (Array.isArray(st.recentEvents)) engineRef.current!.ingestEvents(st.recentEvents);
          setTerm(engineRef.current!.getState());
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tile.appId]);

  useEffect(() => {
    if (!events.length) return;
    engineRef.current!.ingestEvents(events);
    setTerm(engineRef.current!.getState());
  }, [events]);

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflow: "auto" }}>
      <div>
        <StatBoard s={term} />
        <div className="two-col" style={{ marginBottom: 24 }}>
          <Lanes s={term} />
          <Tape s={term} />
        </div>
        <FunnelRow s={term} />
      </div>
    </div>
  );
}
