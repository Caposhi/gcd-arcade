import { useEffect } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { LiveView } from "./LiveView";
import { Automation } from "./Automation";
import { Placeholder } from "./Placeholder";
import { AgentsView } from "./agents/AgentsView";
import { AttributionView } from "./attribution/AttributionView";
import { Clock } from "../shell/Clock";
import { sfx } from "../lib/sound";
import { useSettings } from "../lib/settings";

/** Frames a tile's themed view: header (with back + link-out) and body. */
export function ViewHost({ tile, onBack, onOpenSettings }: { tile: Tile; onBack: () => void; onOpenSettings: () => void }) {
  const { sound } = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") {
        if (sound) sfx.back();
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, sound]);

  const accent = tile.theme?.palette?.[1] ?? tile.theme?.palette?.[0];

  return (
    <div className="view" style={accent ? ({ ["--gcd-royal" as string]: accent } as React.CSSProperties) : undefined}>
      <div className="view-header">
        <span className="vicon">{tile.icon}</span>
        <div>
          <h1>{tile.name}</h1>
          {tile.tagline && <div className="tag">{tile.tagline}</div>}
        </div>
        <div className="spacer" />
        <span className="view-clock">
          <Clock />
        </span>
        {tile.externalUrl && (
          <a className="btn" href={tile.externalUrl} target="_blank" rel="noreferrer">
            Open full dashboard ↗
          </a>
        )}
        <button className="iconbtn" title="Settings" onClick={onOpenSettings}>
          ⚙️
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            if (sound) sfx.back();
            onBack();
          }}
        >
          ← Back
        </button>
      </div>
      <Body tile={tile} />
    </div>
  );
}

function Body({ tile }: { tile: Tile }) {
  switch (tile.view) {
    case "agents":
      return <AgentsView tile={tile} />;
    case "attribution":
      return <AttributionView tile={tile} />;
    case "automation":
      return <Automation tile={tile} />;
    case "placeholder":
      return <Placeholder tile={tile} />;
    // transcripts / sms-inbox / live still use the generic themed live view
    // until their bespoke worlds are built.
    default:
      return <LiveView tile={tile} />;
  }
}
