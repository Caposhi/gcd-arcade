import { useEffect } from "react";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react";
import type { Tile } from "@gcd-arcade/shared";
import { LiveView } from "./LiveView";
import { Automation } from "./Automation";
import { Placeholder } from "./Placeholder";
import { AgentsView } from "./agents/AgentsView";
import { AttributionView } from "./attribution/AttributionView";
import { TranscriptsView } from "./transcripts/TranscriptsView";
import { Clock } from "../shell/Clock";
import { externalHref } from "../lib/bff";
import { AppIcon } from "../lib/icons";

/** Frames a tile's themed view: header (back, icon, name, tagline, link-out,
 *  settings) and body. Light chrome; every tile with an externalUrl keeps
 *  its "Open full app" link-out here, on every screen. */
export function ViewHost({ tile, onBack, onOpenSettings }: { tile: Tile; onBack: () => void; onOpenSettings: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Backspace") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div className="view">
      <div className="view-header">
        <button className="iconbtn" title="Back" onClick={onBack}>
          <ChevronLeft />
        </button>
        <span className="vicon">
          <AppIcon tileId={tile.id} />
        </span>
        <div className="view-title">
          <h1>{tile.name}</h1>
          {tile.tagline && <div className="tag">{tile.tagline}</div>}
        </div>
        <div className="spacer" />
        <span className="view-clock">
          <Clock />
        </span>
        {tile.externalUrl && (
          <a className="btn btn-outline" href={externalHref(tile.externalUrl)} target="_blank" rel="noreferrer">
            Open full app ↗
          </a>
        )}
        <button className="iconbtn" title="Settings" onClick={onOpenSettings}>
          <SettingsIcon />
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
    case "transcripts":
      return <TranscriptsView tile={tile} />;
    case "automation":
      return <Automation tile={tile} />;
    case "placeholder":
      return <Placeholder tile={tile} />;
    // sms-inbox / live still use the generic themed live view until their
    // bespoke worlds are built.
    default:
      return <LiveView tile={tile} />;
  }
}
