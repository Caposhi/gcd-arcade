import { useEffect } from "react";
import { useSettings, type Settings as S } from "../lib/settings";
import { sfx } from "../lib/sound";

const ROWS: { key: keyof S; label: string; hint: string }[] = [
  { key: "sound", label: "Navigation SFX", hint: "XMB blips & chimes" },
  { key: "music", label: "Ambient Music", hint: "background pad (off by default)" },
  { key: "crt", label: "CRT Scanlines", hint: "retro glow overlay" },
  { key: "tvMode", label: "TV Mode", hint: "larger, room-readable layout" },
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
    <div className="overlay" onClick={onClose}>
      <div className="settings" onClick={(e) => e.stopPropagation()}>
        <h2>⚙️ Settings</h2>
        {ROWS.map((r) => (
          <div className="setrow" key={r.key}>
            <div>
              <div style={{ fontWeight: 700 }}>{r.label}</div>
              <div style={{ color: "var(--ink-dim)", fontSize: 13 }}>{r.hint}</div>
            </div>
            <div
              className={`toggle ${s[r.key] ? "on" : ""}`}
              role="switch"
              aria-checked={s[r.key]}
              onClick={() => {
                s.toggle(r.key);
                if (s.sound) sfx.select();
              }}
            />
          </div>
        ))}
        <div style={{ marginTop: 18, textAlign: "right" }}>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
