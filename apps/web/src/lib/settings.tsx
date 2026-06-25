/** Global UI settings (sound, music, CRT, TV mode), persisted to localStorage. */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface Settings {
  sound: boolean; // navigation SFX
  music: boolean; // ambient background music — OFF by default
  crt: boolean; // CRT glow + scanlines
  tvMode: boolean; // larger, room-readable layout
}

const DEFAULTS: Settings = { sound: true, music: false, crt: true, tvMode: false };
const KEY = "gcd-arcade:settings";

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

interface SettingsCtx extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  toggle: (key: keyof Settings) => void;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const set: SettingsCtx["set"] = (key, value) => setSettings((s) => ({ ...s, [key]: value }));
  const toggle: SettingsCtx["toggle"] = (key) => setSettings((s) => ({ ...s, [key]: !s[key] }));

  return <Ctx.Provider value={{ ...settings, set, toggle }}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
