import { useEffect, useMemo, useRef, useState } from "react";
import type { ConsoleState, Tile } from "@gcd-arcade/shared";
import { fetchApps, fetchState } from "../lib/bff";
import { useSettings } from "../lib/settings";
import { AppIcon } from "../lib/icons";

const COLUMNS = 5;

interface LauncherProps {
  onOpen: (tile: Tile) => void;
  /** Lets App.tsx tie the loading screen to real data readiness. */
  onReady?: () => void;
}

/** The Home screen: a static grid of app tiles, Apple-Launchpad style.
 *  Data loading (fetchApps/fetchState) is unchanged from the old Xmb — this
 *  is a presentational rewrite only. */
export function Launcher({ onOpen, onReady }: LauncherProps) {
  const { liveBadges } = useSettings();
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [, setStates] = useState<Record<string, ConsoleState | undefined>>({});
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let alive = true;
    fetchApps()
      .then(async (res) => {
        if (!alive) return;
        setTiles(res.tiles);
        onReady?.();
        const ids = Array.from(new Set(res.tiles.filter((t) => t.enabled && t.online).map((t) => t.appId)));
        const entries = await Promise.all(
          ids.map(async (id) => [id, await fetchState(id).catch(() => undefined)] as const)
        );
        if (alive) setStates(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(String(e));
        onReady?.();
      });
    return () => {
      alive = false;
    };
    // onReady/onOpen are stable from App.tsx; only re-run this fetch on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (i: number) => {
    const t = tiles[i];
    if (!t || !t.enabled) return;
    onOpen(t);
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    let next = index;
    if (e.key === "ArrowRight") next = Math.min(tiles.length - 1, index + 1);
    else if (e.key === "ArrowLeft") next = Math.max(0, index - 1);
    else if (e.key === "ArrowDown") next = Math.min(tiles.length - 1, index + COLUMNS);
    else if (e.key === "ArrowUp") next = Math.max(0, index - COLUMNS);
    else return;
    e.preventDefault();
    setIndex(next);
    tileRefs.current[next]?.focus();
  };

  const count = useMemo(() => tiles.length, [tiles]);

  return (
    <div className="launcher">
      <div className="launcher-grid-wrap">
        {loadError ? (
          <div className="launcher-error">Can't reach the hub — {loadError}. Check that the BFF is running.</div>
        ) : (
          <div className="launcher-grid" onKeyDown={onGridKeyDown}>
            {tiles.map((t, i) => (
              <TileButton
                key={t.id}
                setRef={(el) => (tileRefs.current[i] = el)}
                tile={t}
                showDot={liveBadges}
                onFocus={() => setIndex(i)}
                onClick={() => open(i)}
              />
            ))}
          </div>
        )}
      </div>
      {!loadError && <div className="launcher-footer">{count} apps · tap to open</div>}
    </div>
  );
}

function TileButton({
  tile,
  showDot,
  onFocus,
  onClick,
  setRef,
}: {
  tile: Tile;
  showDot: boolean;
  onFocus: () => void;
  onClick: () => void;
  setRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button type="button" className={`tile ${tile.enabled ? "" : "dim"}`} onFocus={onFocus} onClick={onClick} ref={setRef}>
      <span className="tile-glyph">
        <AppIcon tileId={tile.id} />
        {showDot && <span className={`tile-dot ${tile.enabled && tile.online ? "" : "offline"}`} />}
      </span>
      <span className="tile-label">{tile.name}</span>
    </button>
  );
}
