/**
 * Interactive Recharts for Financial Projections — mirrors gcd-qbo-hub's own
 * src/app/projections/reporting/Charts.tsx so the Arcade tile reads as the
 * same chart, not a simplified stand-in: real axis scales, a legend, a
 * hover tooltip, and click-to-drill. Colors come from chart-theme.ts, which
 * reads Arcade's own CSS tokens (the same brand palette the hub's charts use).
 */
import { useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import type { TrendPoint, CategoryDatum, AgingNormalized } from "./types";
import { money, percent } from "./format";
import { CHART, axisProps, gridProps, barCursor, GcdTooltip } from "./chart-theme";

function EmptyNote({ label }: { label: string }) {
  return <div className="empty">No {label} for this range.</div>;
}

/** Revenue & Net Income over time — one shared dollar axis (no dual-axis),
 *  same as the hub's page: a bar for revenue, a line for net income. */
export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return <EmptyNote label="trend data" />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid {...gridProps} />
        <XAxis dataKey="period" {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v: number) => money(v, true)} width={64} />
        <Tooltip content={<GcdTooltip fmt={(n) => money(n)} />} cursor={barCursor} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
        <Bar dataKey="revenue" name="Revenue" fill={CHART.revenue} radius={[6, 6, 0, 0]} maxBarSize={44} />
        <Line
          dataKey="netIncome"
          name="Net Income"
          type="monotone"
          stroke={CHART.netIncome}
          strokeWidth={2}
          dot={{ r: 3, fill: CHART.netIncome }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Single-hue horizontal bars; a number axis handles a negative value (a
 *  credit sitting in a normally-positive breakdown) as a true diverging bar
 *  automatically — no special-casing needed. Click a bar to see its share. */
export function CategoryChart({ items, unit = "amount" }: { items: CategoryDatum[]; unit?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  if (items.length === 0) return <EmptyNote label={unit} />;
  const total = items.reduce((a, d) => a + d.value, 0);
  const height = Math.max(140, items.length * 34 + 24);
  const sel = selected !== null ? items[selected] : null;

  return (
    <>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v: number) => money(v, true)} />
          <YAxis type="category" dataKey="name" {...axisProps} width={110} tickLine={false} />
          <Tooltip content={<GcdTooltip fmt={(n) => money(n)} />} cursor={barCursor} />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
            onClick={(_, index) => setSelected((cur) => (cur === index ? null : index))}
            cursor="pointer"
          >
            {items.map((_, i) => (
              <Cell key={i} fill={CHART.bar} fillOpacity={selected === null || selected === i ? 1 : 0.45} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sel && (
        <div className="empty" style={{ textAlign: "left", padding: "6px 0 0" }}>
          <strong style={{ color: "var(--text-strong)" }}>{sel.name}</strong> — {money(sel.value)}{" "}
          {total !== 0 && <span>({percent(sel.value / total)} of {money(total, true)})</span>}
        </div>
      )}
    </>
  );
}

/** A/R or A/P aging by bucket, colored by a severity ramp (current → 91+).
 *  Click a bucket to drill into which customers/vendors sit in it. */
export function AgingChart({ aging, entityLabel }: { aging: AgingNormalized; entityLabel: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const chartData = aging.bucketLabels.map((label, i) => ({ bucket: label, amount: aging.totals[i] ?? 0 }));
  if (aging.total === 0) return <EmptyNote label="open balances" />;

  const drill =
    selected !== null
      ? [...aging.rows]
          .map((r) => ({ name: r.name, amount: r.buckets[selected] ?? 0 }))
          .filter((r) => Math.abs(r.amount) >= 0.005)
          .sort((a, b) => b.amount - a.amount)
      : [];

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="bucket" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v: number) => money(v, true)} width={64} />
          <Tooltip content={<GcdTooltip fmt={(n) => money(n)} />} cursor={barCursor} />
          <Bar
            dataKey="amount"
            radius={[6, 6, 6, 6]}
            maxBarSize={56}
            onClick={(_, index) => setSelected((cur) => (cur === index ? null : index))}
            cursor="pointer"
          >
            {chartData.map((_, i) => (
              <Cell
                key={i}
                fill={CHART.aging[Math.min(i, CHART.aging.length - 1)]}
                fillOpacity={selected === null || selected === i ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {selected !== null && (
        <div style={{ marginTop: 4 }}>
          <div className="empty" style={{ textAlign: "left", padding: "0 0 6px", fontSize: 12 }}>
            {entityLabel}s in <strong style={{ color: "var(--text-strong)" }}>{aging.bucketLabels[selected]}</strong>
          </div>
          {drill.length === 0 ? (
            <div className="empty">Nothing in this bucket.</div>
          ) : (
            drill.slice(0, 8).map((r) => (
              <div className="kpi-row" key={r.name}>
                <span>{r.name}</span>
                <b>{money(r.amount, true)}</b>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
