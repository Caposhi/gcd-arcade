import { useEffect } from "react";
import { useSettings, type Settings as S } from "../lib/settings";

const APPEARANCE_OPTIONS: { value: S["appearance"]; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-card" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className="settings-section">
          <div className="label">Appearance</div>
          <div className="segmented">
            {APPEARANCE_OPTIONS.map((o) => (
              <button
                key={o.value}
                className={`btn btn-sm btn-full ${s.appearance === o.value ? "" : "btn-secondary"}`}
                onClick={() => s.set("appearance", o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="toggle-row">
          <div>
            <div className="title">Live status on tiles</div>
            <div className="hint">Show a status dot for each app</div>
          </div>
          <button
            className={`toggle ${s.liveBadges ? "on" : ""}`}
            role="switch"
            aria-checked={s.liveBadges}
            onClick={() => s.toggle("liveBadges")}
          >
            <i />
          </button>
        </div>

        <div className="toggle-row" style={{ borderBottom: "none" }}>
          <div>
            <div className="title">Reduce motion</div>
            <div className="hint">Turn off transitions and animation</div>
          </div>
          <button
            className={`toggle ${s.reducedMotion ? "on" : ""}`}
            role="switch"
            aria-checked={s.reducedMotion}
            onClick={() => s.toggle("reducedMotion")}
          >
            <i />
          </button>
        </div>

        <div className="settings-footer">
          <span className="version">GCD Arcade · v2.0</span>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
