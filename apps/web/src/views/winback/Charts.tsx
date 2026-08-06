/**
 * Recharts for Declined-Job Win-Back — mirrors the same visual language as
 * qbo/Charts.tsx (shared chart-theme tokens, same axis/tooltip/grid
 * conventions) even though this program lives in a different backend
 * (gcd-webhook, not gcd-qbo-hub).
 */
import { ResponsiveContainer, BarChart, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { CHART, axisProps, gridProps, barCursor, GcdTooltip } from "../qbo/chart-theme";
import { money } from "../qbo/format";
import type { WinbackTrendPoint } from "./types";

function EmptyNote({ label }: { label: string }) {
  return <div className="empty">No {label} for this range.</div>;
}

/** Declined $ value per week. */
export function WinbackVolumeChart({ trend }: { trend: WinbackTrendPoint[] }) {
  if (trend.length === 0) return <EmptyNote label="volume data" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="period" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v: number) => money(v, true)} width={64} />
        <Tooltip content={<GcdTooltip fmt={(n) => money(n)} />} cursor={barCursor} />
        <Bar dataKey="declinedValue" name="Declined value" fill={CHART.expense} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Declined-job count vs. reminders sent per week — one shared count axis
 *  (both are counts, not dollars, so no dual-axis issue). */
export function WinbackActivityChart({ trend }: { trend: WinbackTrendPoint[] }) {
  if (trend.length === 0) return <EmptyNote label="activity data" />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="period" {...axisProps} />
        <YAxis {...axisProps} allowDecimals={false} width={40} />
        <Tooltip content={<GcdTooltip fmt={(n) => String(Math.round(n))} />} cursor={barCursor} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
        <Bar dataKey="declinedCount" name="Declined jobs" fill={CHART.bar} radius={[6, 6, 0, 0]} maxBarSize={36} />
        <Line dataKey="remindersSent" name="Reminders sent" type="monotone" stroke={CHART.netIncome} strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
