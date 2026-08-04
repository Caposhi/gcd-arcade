import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import type { Tile } from "@gcd-arcade/shared";
import { Boot } from "./shell/Boot";
import { Launcher } from "./shell/Launcher";
import { Clock } from "./shell/Clock";
import { SettingsPanel } from "./shell/Settings";
import { ViewHost } from "./views/ViewHost";

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
  // The loading screen shows once per session (survives in-app navigation,
  // not reloads) and clears as soon as the Launcher's first fetchApps() call
  // resolves — real data readiness, not a timer.
  const [mode, setMode] = useState<Mode>(() => (safeSessionGet("booted") ? "home" : "boot"));
  const [open, setOpen] = useState<Tile | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const bootDone = () => {
    safeSessionSet("booted", "1");
    setMode("home");
  };

  return (
    <div className="app-root">
      {/* Launcher chrome — only on the home screen. When a view is open it
          provides its own header (icon + name + back), so the global bar
          must step aside or it overlaps and steals clicks. */}
      {!open && (
        <div className="topbar">
          <div className="brand">
            GCD <b>Arcade</b>
          </div>
          <div className="topbar-right">
            <span className="clock-text">
              <Clock />
            </span>
            <button className="iconbtn" title="Settings" onClick={() => setShowSettings(true)}>
              <SettingsIcon />
            </button>
          </div>
        </div>
      )}

      {!open && <Launcher onOpen={setOpen} onReady={bootDone} />}
      {open && <ViewHost tile={open} onBack={() => setOpen(null)} onOpenSettings={() => setShowSettings(true)} />}

      {mode === "boot" && <Boot />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
