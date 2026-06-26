import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { useSettings } from "../../lib/settings";
import { sfx } from "../../lib/sound";
import { AgencyEngine, type Moment, type OfficeState } from "./engine";
import { Office } from "./Office";
import { Hud } from "./Hud";
import { MomentOverlay } from "./Moments";
import "./agents.css";

const MOMENT_MS: Record<string, number> = { published: 2600, levelup: 2600, fail: 1700, escalated: 2200 };

/**
 * GCD-SOCIAL "Agents Live View" rendered as a Game Dev Tycoon-style marketing
 * agency. The engine reduces the live SSE feed into office state; this
 * component owns the React glue, sound, and the transient "moment" overlays.
 */
export function AgentsView({ tile }: { tile: Tile }) {
  const { sound } = useSettings();
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const { events, status } = useStream(tile.appId);
  const [moment, setMoment] = useState<Moment | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  // The moment handler is kept in a ref so the engine (created once, below) can
  // always call the latest closure without re-instantiating.
  const onMomentRef = useRef<(m: Moment) => void>(() => {});
  onMomentRef.current = (m) => {
    if (soundRef.current) playMoment(m);
    if (m.kind === "work") return; // soft tick only, no overlay
    setMoment(m);
    clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setMoment(null), MOMENT_MS[m.kind] ?? 1800);
  };

  // One engine instance for the lifetime of the view; seed initial office state.
  const engineRef = useRef<AgencyEngine | null>(null);
  const [office, setOffice] = useState<OfficeState>(() => {
    const engine = new AgencyEngine((m) => onMomentRef.current(m));
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
          // Seed from the authoritative recent-event history so the office
          // reflects the latest brief even if the live stream came up late or
          // replayed only partially. Old events update visuals, not fanfare.
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

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  if (!office) return null;

  return (
    <div className="agency">
      <Hud office={office} />
      <div className="agency-stage">
        <Office office={office} />
        <aside className="agency-side">
          <CurrentBrief office={office} streamStatus={status} />
          <div className="sidebox" style={{ flex: 1 }}>
            <h4>📣 Shipped Posts</h4>
            {office.publishedPosts.length === 0 ? (
              <div style={{ color: "#9fb0d6", fontSize: 13 }}>No posts shipped yet this session.</div>
            ) : (
              office.publishedPosts.map((p) => (
                <div className="postcard" key={p.id}>
                  <div className="pthumb" style={p.imageUrl ? { backgroundImage: `url(${p.imageUrl})` } : undefined}>
                    {p.imageUrl ? "" : "🖼️"}
                  </div>
                  <div className="pcap">{p.caption ?? "Published post"}</div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
      <MomentOverlay moment={moment} />
    </div>
  );
}

function CurrentBrief({ office, streamStatus }: { office: OfficeState; streamStatus: string }) {
  const b = office.brief;
  return (
    <div className="sidebox">
      <h4>
        🎬 On the Floor{" "}
        <span style={{ color: streamStatus === "open" ? "#38d96b" : streamStatus === "error" ? "#e9456a" : "#f8e000" }}>
          ●
        </span>
      </h4>
      {!b || !office.running ? (
        <div style={{ color: "#9fb0d6", fontSize: 13 }}>
          {streamStatus === "error" ? "Live feed unavailable — agency offline." : "No active brief. Studio idle."}
        </div>
      ) : (
        <div style={{ fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            {b.status === "awaiting" ? "Awaiting sign-off" : "In production"}
          </div>
          <div style={{ color: "#cdd8f5" }}>{b.caption ?? `Brief ${b.id}`}</div>
          {b.verdict && (
            <div style={{ marginTop: 6, fontWeight: 700, color: b.verdict === "PASS" ? "#7cf08a" : "#ff8aa0" }}>
              Critic: {b.verdict}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function playMoment(m: Moment): void {
  switch (m.kind) {
    case "published":
      sfx.cash();
      break;
    case "levelup":
      sfx.levelup();
      break;
    case "fail":
      sfx.fail();
      break;
    case "escalated":
      sfx.alert();
      break;
    case "stamp":
      sfx.stamp();
      break;
    case "work":
      sfx.work();
      break;
  }
}
