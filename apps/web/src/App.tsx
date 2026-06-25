import { useEffect, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { Boot } from "./shell/Boot";
import { Xmb } from "./shell/Xmb";
import { Clock } from "./shell/Clock";
import { Crt } from "./shell/Crt";
import { SettingsPanel } from "./shell/Settings";
import { ViewHost } from "./views/ViewHost";
import { useSettings } from "./lib/settings";
import { setMusicTrack } from "./lib/sound";

type Mode = "boot" | "home";

// Storage access can throw (privacy extensions / strict browser settings block
// it on some origins). Never let that crash the whole app — degrade gracefully.
function safeSessionGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function App() {
  const settings = useSettings();
  // Boot shows once per session (survives in-app navigation, not reloads).
  const [mode, setMode] = useState<Mode>(() => (safeSessionGet("booted") ? "home" : "boot"));
  const [open, setOpen] = useState<Tile | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Single source of truth for the music track: the Agents view gets the
  // upbeat tycoon loop, everything else the ambient XMB pad. Gated by Music.
  useEffect(() => {
    const track = open?.view === "agents" ? "agency" : "ambient";
    setMusicTrack(track, settings.music);
  }, [open, mode, settings.music]);

  const bootDone = () => {
    safeSessionSet("booted", "1");
    setMode("home");
  };

  return (
    <div className={`app-root ${settings.tvMode ? "tv" : ""}`}>
      <div className="xmb-wave" />

      <div className="topbar">
        <div className="brand">
          GCD<b>·</b>ARCADE
        </div>
        <div className="topbar-right">
          <Clock />
          <button className="iconbtn" title="Settings" onClick={() => setShowSettings(true)}>
            ⚙️
          </button>
        </div>
      </div>

      {mode === "home" && !open && <Xmb onOpen={setOpen} />}
      {mode === "home" && open && <ViewHost tile={open} onBack={() => setOpen(null)} />}

      {mode === "boot" && <Boot onDone={bootDone} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <Crt />
    </div>
  );
}
