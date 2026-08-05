/**
 * GCD QBO Hub — Financial Projections, redesigned (§ QBO Hub redesign,
 * phase 1 of 3). Same visual language as Call Transcripts/Attribution
 * (panel / stat-card / funnel-row bars, no bespoke chrome) — replaces the
 * generic live-view fallback with the actual reporting data the hub's own
 * /projections Reporting tab already computes: KPI tiles with period-over-
 * period deltas, a revenue/net-income trend, expense/customer/item
 * breakdowns, A/R & A/P aging, GCD Pal's deterministic insight bullets, and
 * the shared AI Report Assistant panel at the bottom.
 *
 * Charts are hand-rolled divs (funnel-row bars, a small trend mini-chart) to
 * match how every other world here renders data — no new chart library.
 */
import { useEffect, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchQboReporting } from "../../lib/bff";
import { AiChatPanel } from "./AiChatPanel";
import { money, formatKpiValue, formatDelta, fmtWhen } from "./format";
import type {
  ReportingBridgeResponse,
  Kpi,
  CategoryDatum,
  AgingNormalized,
  TrendPoint,
  PalInsight,
  RangePreset,
  ComparisonMode,
  AccountingMethodDto,
  GranularityDto,
} from "./types";

interface Filters {
  preset: RangePreset;
  comparison: ComparisonMode;
  method: AccountingMethodDto;
  granularity: GranularityDto;
}

const DEFAULT_FILTERS: Filters = { preset: "this_month", comparison: "prior_period", method: "accrual", granularity: "month" };

const PRESET_OPTIONS: { value: RangePreset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "trailing_12", label: "Trailing 12" },
];

export function ProjectionsView({ tile }: { tile: Tile }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<ReportingBridgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ text: string; nonce: number } | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchQboReporting(tile.appId, filters)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => alive && setError(String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tile.appId, filters.preset, filters.comparison, filters.method, filters.granularity]);

  const askAbout = (prompt: string) => setSeed((prev) => ({ text: prompt, nonce: (prev?.nonce ?? 0) + 1 }));

  const reporting = data?.reporting;

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflowY: "auto", overflowX: "hidden" }}>
      <div>
        <FilterBar filters={filters} onChange={setFilters} />

        {data && data.insights.length > 0 && <InsightsStrip insights={data.insights} onAsk={askAbout} />}

        {error && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Couldn't load reporting — {error}.</div>
          </div>
        )}

        {loading && !data && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Loading reporting…</div>
          </div>
        )}

        {reporting && !reporting.connected && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">
              {reporting.reason === "reconnect_required"
                ? "QuickBooks rejected the saved connection for this environment and there's no cached snapshot for this range. An owner needs to reconnect QBO from the hub's Cash Sheet Sync settings."
                : "QuickBooks isn't connected for this environment yet and there's no cached snapshot for this range. An owner needs to connect QBO from the hub's Cash Sheet Sync settings."}
            </div>
          </div>
        )}

        {reporting && reporting.connected && (
          <>
            <div className="stat-grid" style={{ marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
              {reporting.kpis.map((k) => (
                <KpiTile key={k.key} kpi={k} />
              ))}
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <h3>Revenue &amp; Net Income</h3>
              <TrendChart trend={reporting.trend} />
            </div>

            <div className="panel-grid" style={{ marginBottom: 24 }}>
              <CategoryPanel title="Revenue by Service / Product" items={reporting.revenueByItem} />
              <CategoryPanel title="Revenue by Customer" items={reporting.revenueByCustomer} />
              <CategoryPanel title="Operating Expenses" items={reporting.expenseBreakdown} />
            </div>

            <div className="two-col" style={{ marginBottom: 24 }}>
              <AgingPanel title="A/R Aging" aging={reporting.arAging} entityLabel="Customer" />
              <AgingPanel title="A/P Aging" aging={reporting.apAging} entityLabel="Vendor" />
            </div>

            <div className="panel" style={{ marginBottom: 24 }}>
              <div className="kpi-row">
                <span>Cash position</span>
                <b>{money(reporting.balanceSheet.cash, true)}</b>
              </div>
              <div className="kpi-row">
                <span>Total assets</span>
                <b>{money(reporting.balanceSheet.totalAssets, true)}</b>
              </div>
              <div className="empty" style={{ padding: "8px 0 0", textAlign: "left" }}>
                Read-only from QuickBooks Online — snapshot {fmtWhen(reporting.fetchedAt)}. No figures are ever written back.
              </div>
            </div>
          </>
        )}

        <AiChatPanel appId={tile.appId} seed={seed} />
      </div>
    </div>
  );
}

// -------------------------------- filter bar ---------------------------------

function FilterBar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="panel" style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Range</span>
        <select
          className="text-input select-input"
          value={filters.preset}
          onChange={(e) => onChange({ ...filters, preset: e.target.value as RangePreset })}
        >
          {PRESET_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Compare to</span>
        <select
          className="text-input select-input"
          value={filters.comparison}
          onChange={(e) => onChange({ ...filters, comparison: e.target.value as ComparisonMode })}
        >
          <option value="prior_period">Prior period</option>
          <option value="prior_year">Prior year</option>
        </select>
      </label>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Method</span>
        <select
          className="text-input select-input"
          value={filters.method}
          onChange={(e) => onChange({ ...filters, method: e.target.value as AccountingMethodDto })}
        >
          <option value="accrual">Accrual</option>
          <option value="cash">Cash</option>
        </select>
      </label>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Trend by</span>
        <select
          className="text-input select-input"
          value={filters.granularity}
          onChange={(e) => onChange({ ...filters, granularity: e.target.value as GranularityDto })}
        >
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </select>
      </label>
    </div>
  );
}

// ------------------------------ insights strip -------------------------------

const TONE_DOT: Record<PalInsight["tone"], string> = {
  good: "var(--success)",
  watch: "var(--warn, #d97706)",
  bad: "var(--danger)",
  info: "var(--gray-400)",
};

function InsightsStrip({ insights, onAsk }: { insights: PalInsight[]; onAsk: (prompt: string) => void }) {
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <h3>GCD Pal Insights</h3>
      {insights.map((ins, i) => (
        <div className="insight-row" key={i}>
          <span className="dot" style={{ background: TONE_DOT[ins.tone] }} />
          <span className="insight-text">{ins.text}</span>
          <button className="btn-outline btn-sm" onClick={() => onAsk(ins.prompt)}>
            Ask
          </button>
        </div>
      ))}
    </div>
  );
}

// --------------------------------- KPI tile -----------------------------------

function KpiTile({ kpi }: { kpi: Kpi }) {
  const dir = kpi.delta.sentiment === "good" ? "good" : kpi.delta.sentiment === "bad" ? "bad" : "neutral";
  return (
    <div className="stat-card">
      <div className="lbl">{kpi.label}</div>
      <div className="val">{formatKpiValue(kpi.value, kpi.format)}</div>
      <div className={`delta ${dir}`} title="vs. comparison period">
        {formatDelta(kpi.delta)}
      </div>
    </div>
  );
}

// -------------------------------- trend chart ---------------------------------

function TrendChart({ trend }: { trend: TrendPoint[] }) {
  if (trend.length === 0) return <div className="empty">No trend data for this range.</div>;
  const max = Math.max(1, ...trend.map((t) => Math.abs(t.revenue)));
  return (
    <div className="trend-chart">
      {trend.map((t) => (
        <div className="trend-col" key={t.period} title={`${t.period}: revenue ${money(t.revenue, true)}, net income ${money(t.netIncome, true)}`}>
          <div className={`trend-net ${t.netIncome >= 0 ? "good" : "bad"}`}>{money(t.netIncome, true)}</div>
          <div className="trend-bar" style={{ height: `${Math.max(2, (Math.abs(t.revenue) / max) * 100)}%` }} />
          <div className="trend-period">{t.period}</div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------- category breakdowns ----------------------------

function CategoryPanel({ title, items }: { title: string; items: CategoryDatum[] }) {
  if (items.length === 0) {
    return (
      <div className="panel">
        <h3>{title}</h3>
        <div className="empty">No data for this range.</div>
      </div>
    );
  }
  const max = Math.max(1, ...items.map((r) => Math.abs(r.value)));
  return (
    <div className="panel">
      <h3>{title}</h3>
      {items.map((r) => (
        <div className="funnel-row" key={r.name}>
          <span className="stage" style={{ width: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>
            {r.name}
          </span>
          <span className="bar-track">
            <BarFill value={r.value} max={max} />
          </span>
          <span className="stage-value" style={r.value < 0 ? { color: "var(--text-muted)" } : undefined}>
            {money(r.value, true)}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A funnel-row bar that only fills for a positive amount. A negative value
 *  (a credit/overpayment sitting in what's normally an "owed" bucket) drawn
 *  as a normal full-width bar reads as "a large amount owed" — exactly
 *  backwards — so it renders as an empty track instead; the muted, signed
 *  figure alone conveys it. */
function BarFill({ value, max }: { value: number; max: number }) {
  if (value < 0) return <i style={{ width: "3%", background: "var(--gray-300)" }} />;
  return <i style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />;
}

function AgingPanel({ title, aging, entityLabel }: { title: string; aging: AgingNormalized; entityLabel: string }) {
  if (aging.total === 0) {
    return (
      <div className="panel">
        <h3>{title}</h3>
        <div className="empty">No open balances.</div>
      </div>
    );
  }
  const max = Math.max(1, ...aging.totals.map((v) => Math.abs(v)));
  const topRows = [...aging.rows].sort((a, b) => b.total - a.total).slice(0, 5);
  return (
    <div className="panel">
      <h3>{title}</h3>
      <div className="empty" style={{ padding: "0 0 10px", textAlign: "left" }}>
        Total {money(aging.total, true)}
      </div>
      {aging.bucketLabels.map((label, i) => {
        const v = aging.totals[i] ?? 0;
        return (
          <div className="funnel-row" key={label}>
            <span className="stage">{label}</span>
            <span className="bar-track">
              <BarFill value={v} max={max} />
            </span>
            <span className="stage-value" style={v < 0 ? { color: "var(--text-muted)" } : undefined}>
              {money(v, true)}
            </span>
          </div>
        );
      })}
      {topRows.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>Largest {entityLabel}s</h3>
          {topRows.map((r) => (
            <div className="kpi-row" key={r.name}>
              <span>{r.name}</span>
              <b>{money(r.total, true)}</b>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
