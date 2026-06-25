import { useSettings } from "../lib/settings";

/** CRT glow + scanline overlay. Toggleable; remembered in localStorage. */
export function Crt() {
  const { crt } = useSettings();
  if (!crt) return null;
  return <div className="crt" aria-hidden />;
}
