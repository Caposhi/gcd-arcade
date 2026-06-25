/** Display formatting for the trading desk. Honors "show real figures". */

export function money(v: number | undefined): string {
  if (v === undefined) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

export function moneyExact(v: number | undefined): string {
  if (v === undefined) return "—";
  return `$${Math.round(v).toLocaleString()}`;
}

export function roasText(v: number | undefined): string {
  return v === undefined ? "—" : `${v.toFixed(2)}×`;
}

export function pctText(v: number | undefined): string {
  return v === undefined ? "—" : `${v}%`;
}

/** Direction of change vs. a previous value, for up/down coloring. */
export function dir(curr: number | undefined, prev: number | undefined): "up" | "down" | "flat" {
  if (curr === undefined || prev === undefined) return "flat";
  if (curr > prev) return "up";
  if (curr < prev) return "down";
  return "flat";
}

/** CAC is "good when down", so its arrow semantics invert. */
export function dirInverted(curr: number | undefined, prev: number | undefined): "up" | "down" | "flat" {
  const d = dir(curr, prev);
  return d === "up" ? "down" : d === "down" ? "up" : "flat";
}

export function timeText(at: string): string {
  if (!at) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
