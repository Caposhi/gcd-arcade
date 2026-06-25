import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { useSettings } from "../../lib/settings";
import { sfx } from "../../lib/sound";
import { AttributionEngine, type Moment, type TerminalState } from "./engine";
import { Ticker, IndexBoard } from "./Board";
import { Lanes } from "./Lanes";
import { FunnelRow } from "./Funnel";
import { Tape } from "./Tape";
import { AttrMoment } from "./Moments";
import "./attribution.css";

const MOMENT_MS: Record<string, number> = { match: 1700, capi: 1500, highroas: 1900, failed: 2100 };

/**
 * Attribution rendered as a neon trading terminal. The engine reduces the
 * BullMQ SSE feed + state snapshot into terminal state; this owns the React
 * glue, sound, and the transient "moment" overlays.
 */
export function AttributionView({ tile }: { tile: Tile }) {
  const { sound } = useSettings();
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const { events, status } = useStream(tile.appId);
  const [moment, setMoment] = useState<Moment | null>(null);
  const [pulse, setPulse] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();
  const pulseTimer = useRef<ReturnType<typeof setTimeout>>();

  const onMomentRef = useRef<(m: Moment) => void>(() => {});
  onMomentRef.current = (m) => {
    if (soundRef.current) playMoment(m);
    if (m.kind === "highroas") {
      setPulse(true);
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 900);
    }
    setMoment(m);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMoment(null), MOMENT_MS[m.kind] ?? 1700);
  };

  const engineRef = useRef<AttributionEngine | null>(null);
  const [term, setTerm] = useState<TerminalState>(() => {
    const engine = new AttributionEngine((m) => onMomentRef.current(m));
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

  useEffect(
    () => () => {
      clearTimeout(clearTimer.current);
      clearTimeout(pulseTimer.current);
    },
    []
  );

  return (
    <div className="attr">
      <Ticker s={term} />
      <div className="attr-body">
        <div className="attr-main">
          <IndexBoard s={term} pulse={pulse} />
          <Lanes s={term} />
          <FunnelRow s={term} />
        </div>
        <Tape s={term} />
      </div>
      {status === "error" && term.prints.length === 0 && (
        <div className="offline-note">Live feed unavailable — desk offline. Showing last known state.</div>
      )}
      <AttrMoment moment={moment} />
    </div>
  );
}

function playMoment(m: Moment): void {
  switch (m.kind) {
    case "match":
      sfx.cash();
      break;
    case "capi":
      sfx.stamp();
      break;
    case "highroas":
      sfx.levelup();
      break;
    case "failed":
      sfx.alert();
      break;
  }
}
