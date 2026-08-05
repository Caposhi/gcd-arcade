/**
 * Shared Recharts config for the GCD QBO Hub world in the Arcade — mirrors
 * gcd-qbo-hub's own src/app/components/chart-theme.tsx so Financial
 * Projections' charts read as the same visual language as the hub's native
 * page, not a simplified stand-in. Arcade's own CSS tokens (theme/arcade.css)
 * already share the hub's brand palette almost 1:1 (royal-blue ≈ hub's
 * revenue blue, success ≈ netIncome green, danger ≈ the aging ramp's reddest
 * step), so this reads the tokens directly rather than duplicating hex values.
 */
import type { ReactNode } from "react";

export const CHART = {
  revenue: "var(--royal-blue)",
  netIncome: "var(--success)",
  bar: "var(--royal-blue)",
  expense: "#C77A00", // warning ochre — no existing Arcade token for this hue
  // Aging severity ramp, current -> 91+. Matches the hub's own aging ramp.
  aging: ["#2E63C9", "#5B84D6", "#C77A00", "#E0631E", "var(--danger)"],
  grid: "var(--gray-200)",
  axis: "var(--gray-500)",
} as const;

export const axisProps = {
  stroke: CHART.grid,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: "var(--font-body)" },
  tickLine: false,
  axisLine: { stroke: CHART.grid },
} as const;

export const gridProps = { stroke: CHART.grid, strokeDasharray: "3 3", vertical: false } as const;

/** Hover cursor: a faint navy wash, matching the hub's own bar-hover state. */
export const barCursor = { fill: "rgba(24,40,72,0.05)" } as const;

interface TooltipPayloadEntry {
  name?: string;
  value?: number;
  color?: string;
}

/** White card, navy text, soft shadow — never a dark-on-dark bubble on a
 *  light-surface chart. Give each series a `name`; the swatch echoes its
 *  series color automatically. */
export function GcdTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string | number;
  fmt: (n: number) => string;
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        boxShadow: "var(--shadow-lg, var(--shadow-sm))",
        padding: "10px 13px",
        fontSize: 12,
        color: "var(--text-strong)",
        minWidth: 150,
        pointerEvents: "none",
      }}
    >
      {label !== undefined && (
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 13, marginBottom: 6, color: "var(--royal-blue)" }}>
          {label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: i ? 3 : 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color || CHART.revenue }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 700, color: "var(--royal-blue)" }}>{fmt(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}
