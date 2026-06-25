import { useEffect } from "react";
import { sfx } from "../lib/sound";
import { useSettings } from "../lib/settings";

/** Short PlayStation-style boot intro. Skippable; shown once per session. */
export function Boot({ onDone }: { onDone: () => void }) {
  const { sound } = useSettings();

  useEffect(() => {
    if (sound) sfx.boot();
    const t = setTimeout(onDone, 2800);
    const onKey = () => onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone, sound]);

  return (
    <div className="boot" onClick={onDone}>
      <div className="logo">
        GCD<b>·</b>ARCADE
      </div>
      <div className="bar" />
      <div className="skip">press any key to skip</div>
    </div>
  );
}
