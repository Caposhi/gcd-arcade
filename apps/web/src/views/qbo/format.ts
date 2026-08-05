/** Display formatting for the GCD QBO Hub world. */
import type { Delta, KpiFormat } from "./types";

export function money(v: number, compact = false): string {
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  if (compact && abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (compact && abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${Math.round(abs).toLocaleString()}`;
}

export function percent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function formatKpiValue(value: number, format: KpiFormat): string {
  return format === "percent" ? percent(value) : money(value, true);
}

/** "+12.5% vs. comparison period" / "—" when there's no prior to compare to. */
export function formatDelta(delta: Delta): string {
  if (delta.pct === null) return "—";
  const sign = delta.pct >= 0 ? "+" : "";
  return `${sign}${(delta.pct * 100).toFixed(1)}%`;
}

export function fmtWhen(iso?: string): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
  return new Date(t).toLocaleDateString();
}
