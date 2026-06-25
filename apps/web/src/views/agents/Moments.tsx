import { useMemo } from "react";
import type { Moment } from "./engine";

/** Transient celebratory / alert overlay for a dramatic beat. */
export function MomentOverlay({ moment }: { moment: Moment | null }) {
  if (!moment) return null;
  switch (moment.kind) {
    case "published":
      return (
        <div className="moment published" key={moment.seq}>
          <Confetti />
          <div className="banner">📣 POST SHIPPED!</div>
        </div>
      );
    case "levelup":
      return (
        <div className="moment levelup" key={moment.seq}>
          <Confetti />
          <div className="banner">⭐ LEVEL {moment.level}!</div>
        </div>
      );
    case "fail":
      return (
        <div className="moment fail" key={moment.seq}>
          <div className="banner">↩ SEND BACK — rework</div>
        </div>
      );
    case "escalated":
      return (
        <div className="moment escalated" key={moment.seq}>
          <div className="banner">🚨 BOSS CALLED IN</div>
        </div>
      );
    default:
      return null;
  }
}

const COLORS = ["#ffe066", "#36c2ff", "#ff6ad5", "#7cf08a", "#ff8a5c", "#ffffff"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: (i % 10) * 0.08,
        dur: 1.6 + ((i * 13) % 12) / 10,
        color: COLORS[i % COLORS.length],
      })),
    []
  );
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{ left: `${p.left}%`, background: p.color, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}
        />
      ))}
    </div>
  );
}
