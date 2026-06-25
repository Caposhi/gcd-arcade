import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ConsoleState, Tile } from "@gcd-arcade/shared";
import { fetchApps, fetchState } from "../lib/bff";
import { summarizeBadge } from "../lib/badges";
import { sfx } from "../lib/sound";
import { useSettings } from "../lib/settings";

interface XmbProps {
  onOpen: (tile: Tile) => void;
}

/** The XMB home screen: a horizontal ribbon of app tiles + keyboard/gamepad nav. */
export function Xmb({ onOpen }: XmbProps) {
  const { sound } = useSettings();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [states, setStates] = useState<Record<string, ConsoleState | undefined>>({});
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const ribbonRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>();

  // Load tiles, then their states (one fetch per unique online app).
  useEffect(() => {
    let alive = true;
    fetchApps()
      .then(async (res) => {
        if (!alive) return;
        setTiles(res.tiles);
        const ids = Array.from(new Set(res.tiles.filter((t) => t.enabled && t.online).map((t) => t.appId)));
        const entries = await Promise.all(
          ids.map(async (id) => [id, await fetchState(id).catch(() => undefined)] as const)
        );
        if (alive) setStates(Object.fromEntries(entries));
      })
      .catch((e) => alive && setLoadError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const move = useCallback(
    (delta: number) => {
      setIndex((i) => {
        const next = Math.max(0, Math.min(tiles.length - 1, i + delta));
        if (next !== i && sound) sfx.move();
        return next;
      });
    },
    [tiles.length, sound]
  );

  const open = useCallback(() => {
    const t = tiles[index];
    if (!t) return;
    if (!t.enabled) {
      if (sound) sfx.error();
      return;
    }
    if (sound) sfx.enter();
    onOpen(t);
  }, [tiles, index, onOpen, sound]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
          move(-1);
          break;
        case "ArrowRight":
        case "d":
          move(1);
          break;
        case "ArrowDown":
        case "Enter":
        case " ":
          open();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, open]);

  // Center the active tile by translating the ribbon. Recompute after layout
  // (and on resize) so it tracks tile sizing once the DOM is measured.
  useLayoutEffect(() => {
    const recompute = () => {
      const el = ribbonRef.current;
      if (!el) return;
      const active = el.children[index] as HTMLElement | undefined;
      if (!active || !el.parentElement) return;
      const center = el.parentElement.clientWidth / 2;
      const tileCenter = active.offsetLeft + active.offsetWidth / 2;
      setTransform(`translateX(${center - tileCenter}px)`);
    };
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [index, tiles]);

  const selected = tiles[index];

  return (
    <div className="xmb">
      <div className="ribbon" ref={ribbonRef} style={{ transform }}>
        {tiles.map((t, i) => (
          <TileView
            key={t.id}
            tile={t}
            active={i === index}
            badge={summarizeBadge(t, states[t.appId])}
            onClick={() => {
              setIndex(i);
              if (i === index) open();
            }}
          />
        ))}
      </div>

      {selected && (
        <div className="selinfo">
          <h2>
            {selected.icon} {selected.name}
          </h2>
          <p>{selected.tagline ?? selected.description ?? "—"}</p>
          <RecentActivity state={states[selected.appId]} program={selected.program} />
        </div>
      )}

      {loadError && (
        <div className="selinfo">
          <h2>⚠️ Can't reach the hub</h2>
          <p>{loadError}. Check that the BFF is running and reachable.</p>
        </div>
      )}

      <div className="hint">← → select · Enter open · Esc back</div>
    </div>
  );
}

function TileView({ tile, active, badge, onClick }: { tile: Tile; active: boolean; badge: string; onClick: () => void }) {
  const cls = ["tile", active ? "active" : "", tile.enabled ? "" : "dim"].join(" ").trim();
  const badgeCls = !tile.enabled ? "badge coin" : !tile.online ? "badge offline" : "badge";
  return (
    <div className={cls} onClick={onClick}>
      <div className="glyph">
        {tile.icon}
        <span className={badgeCls}>{badge}</span>
      </div>
      <div className="label">{tile.name}</div>
    </div>
  );
}

function RecentActivity({ state, program }: { state: ConsoleState | undefined; program?: string }) {
  const events = Array.isArray(state?.recentEvents) ? state!.recentEvents! : [];
  const filtered = program ? events.filter((e) => e.program === program) : events;
  const recent = filtered.slice(-4).reverse();
  if (!recent.length) return null;
  return (
    <div className="recent">
      {recent.map((e) => (
        <div className="row" key={e.id}>
          ▸ {e.kind} {e.message ? `— ${e.message}` : ""}
        </div>
      ))}
    </div>
  );
}
