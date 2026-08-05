/**
 * GCD QBO Hub — Cash Sheet Sync, redesigned (§ QBO Hub redesign, phase 2 of
 * 3). Same visual language as Financial Projections/Call Transcripts/
 * Attribution — replaces the generic live-view fallback with the hub's real
 * sync data: last-run snapshot, attention counts, a week/month/year trend of
 * posting activity and $ volume, the exceptions queue (rows needing a human,
 * deep-linked straight to the hub's own row page), recent sheet edits, a
 * payee leaderboard, GCD Pal's insight bullets, and the shared AI chat panel.
 */
import { useEffect, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchQboCashSheetSync } from "../../lib/bff";
import { AiChatPanel } from "./AiChatPanel";
import { CssVolumeChart, CssActivityChart, CategoryChart } from "./Charts";
import { money, fmtWhen } from "./format";
import type { CashSheetSyncBridgeResponse, CssException, CssRecentEdit, PalInsight, CssWindowDays, CssGranularity } from "./types";

interface Filters {
  window: CssWindowDays;
  granularity: CssGranularity;
}

const DEFAULT_FILTERS: Filters = { window: 90, granularity: "week" };

const WINDOW_OPTIONS: { value: CssWindowDays; label: string }[] = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
];

const ATTENTION_LABELS: { key: keyof CashSheetSyncBridgeResponse["snapshot"]["attention"]; label: string; sev?: "bad" }[] = [
  { key: "error", label: "Errors", sev: "bad" },
  { key: "changedAfterPosting", label: "Changed after posting", sev: "bad" },
  { key: "removedAfterPosting", label: "Removed after posting", sev: "bad" },
  { key: "possibleDuplicates", label: "Possible duplicates" },
  { key: "duplicateRowIds", label: "Duplicate row IDs" },
  { key: "unknownPurpose", label: "Unknown purpose" },
  { key: "missingAccountMapping", label: "Missing account mapping" },
  { key: "missingPayeeMapping", label: "Missing payee mapping" },
  { key: "awaitingQboMatch", label: "Awaiting QBO match" },
  { key: "auditOnly", label: "Audit-only (INV)" },
];

const ROLLOUT_LADDER = ["dry_run", "sandbox_manual", "sandbox_auto", "live_manual", "live_auto"];

export function CashSheetSyncView({ tile }: { tile: Tile }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [data, setData] = useState<CashSheetSyncBridgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ text: string; nonce: number } | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchQboCashSheetSync(tile.appId, filters)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => alive && setError(String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tile.appId, filters.window, filters.granularity]);

  const askAbout = (prompt: string) => setSeed((prev) => ({ text: prompt, nonce: (prev?.nonce ?? 0) + 1 }));

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflowY: "auto", overflowX: "hidden" }}>
      <div>
        <FilterBar filters={filters} onChange={setFilters} />

        {data && data.insights.length > 0 && <InsightsStrip insights={data.insights} onAsk={askAbout} />}

        {error && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Couldn't load Cash Sheet Sync — {error}.</div>
          </div>
        )}

        {loading && !data && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Loading…</div>
          </div>
        )}

        {data && (
          <>
            <SnapshotPanel snapshot={data.snapshot} />

            <div className="stat-grid" style={{ marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
              {ATTENTION_LABELS.map((a) => (
                <AttentionTile key={a.key} label={a.label} n={data.snapshot.attention[a.key]} severe={a.sev === "bad"} />
              ))}
            </div>

            <div className="panel-grid" style={{ marginBottom: 24 }}>
              <div className="panel">
                <h3>Rows Posted &amp; Exceptions</h3>
                <CssActivityChart trend={data.trend} />
              </div>
              <div className="panel">
                <h3>$ Volume Posted</h3>
                <CssVolumeChart trend={data.trend} />
              </div>
            </div>

            <div className="panel-grid" style={{ marginBottom: 24 }}>
              <ExceptionsQueue items={data.exceptions} />
              <RecentEdits items={data.recentEdits} />
              <div className="panel">
                <h3>Payee Leaderboard</h3>
                <CategoryChart items={data.payeeLeaderboard.map((p) => ({ name: p.name, value: p.amount }))} unit="posted amount" />
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
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Window</span>
        <select
          className="text-input select-input"
          value={filters.window}
          onChange={(e) => onChange({ ...filters, window: Number(e.target.value) as CssWindowDays })}
        >
          {WINDOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Trend by</span>
        <select
          className="text-input select-input"
          value={filters.granularity}
          onChange={(e) => onChange({ ...filters, granularity: e.target.value as CssGranularity })}
        >
          <option value="week">Week</option>
          <option value="month">Month</option>
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

// -------------------------------- snapshot ------------------------------------

function SnapshotPanel({ snapshot }: { snapshot: CashSheetSyncBridgeResponse["snapshot"] }) {
  const { lastRun } = snapshot;
  const ladderIdx = ROLLOUT_LADDER.indexOf(snapshot.rolloutStage);
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginBottom: 14 }}>
        <span className="chip">Environment: {snapshot.environment}</span>
        <span className="chip">Rollout: {snapshot.rolloutStage}</span>
        {lastRun && <span className="chip">Last sync {fmtWhen(lastRun.startedAt)}</span>}
      </div>

      {/* Rollout-stage ladder */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {ROLLOUT_LADDER.map((stage, i) => (
          <div
            key={stage}
            title={stage}
            style={{
              flex: 1,
              height: 6,
              borderRadius: "var(--radius-pill)",
              background: i <= ladderIdx ? "var(--royal-blue)" : "var(--gray-200)",
            }}
          />
        ))}
      </div>

      {lastRun ? (
        <div className="stat-grid">
          <MiniStat label="Scanned" n={lastRun.rowsScanned} />
          <MiniStat label="Posted" n={lastRun.rowsPosted} />
          <MiniStat label="Skipped" n={lastRun.rowsSkipped} />
          <MiniStat label="Errors" n={lastRun.rowsError} accent={lastRun.rowsError > 0 ? "bad" : undefined} />
          <MiniStat label="Warnings" n={lastRun.rowsWarning} accent={lastRun.rowsWarning > 0 ? "watch" : undefined} />
        </div>
      ) : (
        <div className="empty">No sync has run yet.</div>
      )}
    </div>
  );
}

function MiniStat({ label, n, accent }: { label: string; n: number; accent?: "bad" | "watch" }) {
  return (
    <div className="stat-card">
      <div className="lbl">{label}</div>
      <div className="val" style={accent === "bad" ? { color: "var(--danger)" } : accent === "watch" ? { color: "var(--warn, #d97706)" } : undefined}>
        {n}
      </div>
    </div>
  );
}

function AttentionTile({ label, n, severe }: { label: string; n: number; severe?: boolean }) {
  return (
    <div className="stat-card">
      <div className="lbl">{label}</div>
      <div className="val" style={n > 0 && severe ? { color: "var(--danger)" } : n > 0 ? { color: "var(--warn, #d97706)" } : { color: "var(--text-muted)" }}>
        {n}
      </div>
    </div>
  );
}

// ------------------------------ exceptions queue ------------------------------

const STATUS_LABEL: Record<string, string> = {
  "Possible Duplicate": "Possible duplicate",
  "Duplicate Row ID": "Duplicate row ID",
  "Unknown Purpose": "Unknown purpose",
  "Missing Account Mapping": "Missing account mapping",
  "Missing Payee Mapping": "Missing payee mapping",
  "Changed After Posting": "Changed after posting",
  "Removed From Sheet After Posting": "Removed after posting",
  Error: "Error",
};

function ExceptionsQueue({ items }: { items: CssException[] }) {
  return (
    <div className="panel panel-scroll">
      <h3>Exceptions Queue {items.length ? `(${items.length})` : ""}</h3>
      {items.length === 0 ? (
        <div className="empty">Nothing needs attention right now.</div>
      ) : (
        items.map((it) => <ExceptionRow key={it.id} item={it} />)
      )}
    </div>
  );
}

function ExceptionRow({ item }: { item: CssException }) {
  const inner = (
    <>
      <span className="row-icon" style={{ background: "var(--bg-muted)" }}>
        <span className="dot" style={{ background: "var(--danger)" }} />
      </span>
      <span className="row-msg wrap">
        <b>{item.name || item.purpose || `${item.tab} · row ${item.row}`}</b>
        <span className="row-sub">
          {STATUS_LABEL[item.status] ?? item.status} · {item.tab} · row {item.row}
          {item.date ? ` · ${item.date}` : ""}
          {item.amount ? ` · ${money(item.amount, true)}` : ""}
        </span>
      </span>
    </>
  );
  if (!item.url) {
    return <div className="event-row">{inner}</div>;
  }
  return (
    <a className="event-row event-row-btn" href={item.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
      {inner}
    </a>
  );
}

// ------------------------------- recent edits ---------------------------------

function RecentEdits({ items }: { items: CssRecentEdit[] }) {
  return (
    <div className="panel panel-scroll">
      <h3>Recent Sheet Edits</h3>
      {items.length === 0 ? (
        <div className="empty">No cell edits detected yet.</div>
      ) : (
        items.map((e) => {
          const inner = (
            <>
              <span className="row-msg wrap">
                <b>{e.tab ? `${e.tab} · row ${e.row}` : "(row removed)"}</b>
                <span className="row-sub">{e.fields.length ? e.fields.join(", ") : e.message ?? "changed"}</span>
              </span>
              <span className="row-ts">{fmtWhen(e.when)}</span>
            </>
          );
          return e.url ? (
            <a className="event-row event-row-btn" key={e.id} href={e.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              {inner}
            </a>
          ) : (
            <div className="event-row" key={e.id}>
              {inner}
            </div>
          );
        })
      )}
    </div>
  );
}
