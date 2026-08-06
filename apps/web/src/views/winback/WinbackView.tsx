/**
 * gcd-webhook Automation Server — Declined-Job Win-Back, redesigned
 * (§ Automation Server redesign, phase 1). First of the 8 Automation Server
 * programs to get a bespoke world, following the same investigation this
 * redesign already did for the QBO Hub modules: real per-job data (category,
 * $ value, reminder/discount stages) exists here with unbounded retention,
 * unlike most of the other 7 programs (see the investigation notes) — so
 * this one earns the same treatment: GCD Pal-style insight bullets, a real
 * snapshot, category/trend charts, and attention lists.
 *
 * NOT the same as a QBO Hub module in one real way: gcd-webhook-server has
 * no shared AI-assistant infrastructure outside its own Call Transcripts
 * subsystem, so there is deliberately no "Ask GCD Pal" chat panel here —
 * insight bullets are plain text, not a launch point into a conversation.
 * Extending Call Transcripts' own AI-chat pattern to Win-Back (and other
 * programs) is a real, separate follow-up if wanted, not an oversight.
 */
import { useEffect, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchWinbackInsights } from "../../lib/bff";
import { CategoryChart } from "../qbo/Charts";
import { WinbackVolumeChart, WinbackActivityChart } from "./Charts";
import { money, fmtWhen } from "../qbo/format";
import type { WinbackAttentionRow, WinbackBridgeResponse, WinbackInsight, WinbackWindowDays } from "./types";

/** "in 20h" / "in 2d" for a FUTURE timestamp (an expiring offer) — `fmtWhen`
 *  is for past timestamps ("2h ago") and would misreport a future one as
 *  "just now" (its diff-in-minutes goes negative, which it treats as < 1). */
function fmtUntil(iso?: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffMin = Math.round((t - Date.now()) / 60000);
  if (diffMin <= 0) return "now";
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffMin < 60 * 24) return `in ${Math.round(diffMin / 60)}h`;
  return `in ${Math.round(diffMin / (60 * 24))}d`;
}

const WINDOW_OPTIONS: { value: WinbackWindowDays; label: string }[] = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
];

export function WinbackView({ tile }: { tile: Tile }) {
  const [windowDays, setWindowDays] = useState<WinbackWindowDays>(90);
  const [data, setData] = useState<WinbackBridgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchWinbackInsights(tile.appId, windowDays)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => alive && setError(String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tile.appId, windowDays]);

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflowY: "auto", overflowX: "hidden" }}>
      <div>
        <FilterBar windowDays={windowDays} onChange={setWindowDays} />

        {data && data.insights.length > 0 && <InsightsStrip insights={data.insights} />}

        {error && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Couldn't load Win-Back — {error}.</div>
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

            <div className="panel-grid" style={{ marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
              <div className="panel">
                <h3>Declined Jobs &amp; Reminders</h3>
                <WinbackActivityChart trend={data.trend} />
              </div>
              <div className="panel">
                <h3>Declined $ Value</h3>
                <WinbackVolumeChart trend={data.trend} />
              </div>
              <div className="panel">
                <h3>Declined Value by Category</h3>
                <CategoryChart items={data.byCategory.map((c) => ({ name: c.category, value: c.declinedValue }))} unit="declined value" />
              </div>
            </div>

            <div className="panel-grid" style={{ marginBottom: 24 }}>
              <AttentionList
                title="Eligible for a Reminder"
                subtitle={`Past the reminder-delay window, not yet reminded — highest value first.`}
                items={data.attention.eligibleNotReminded}
                dateField="declinedAt"
                dateLabel="declined"
                fmtDate={fmtWhen}
                accent="watch"
              />
              <AttentionList
                title="Offers Expiring Soon"
                subtitle="Win-back discount offers expiring within 48 hours."
                items={data.attention.offerExpiringSoon}
                dateField="offerExpiresAt"
                dateLabel="expires"
                fmtDate={fmtUntil}
                accent="bad"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------- filter bar ---------------------------------

function FilterBar({ windowDays, onChange }: { windowDays: WinbackWindowDays; onChange: (w: WinbackWindowDays) => void }) {
  return (
    <div className="panel" style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Trend window</span>
        <select
          className="text-input select-input"
          value={windowDays}
          onChange={(e) => onChange(Number(e.target.value) as WinbackWindowDays)}
        >
          {WINDOW_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// ------------------------------ insights strip -------------------------------

const TONE_DOT: Record<WinbackInsight["tone"], string> = {
  good: "var(--success)",
  watch: "var(--warn, #d97706)",
  bad: "var(--danger)",
  info: "var(--gray-400)",
};

function InsightsStrip({ insights }: { insights: WinbackInsight[] }) {
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <h3>Insights</h3>
      {insights.map((ins, i) => (
        <div className="insight-row" key={i}>
          <span className="dot" style={{ background: TONE_DOT[ins.tone] }} />
          <span className="insight-text">{ins.text}</span>
        </div>
      ))}
    </div>
  );
}

// -------------------------------- snapshot ------------------------------------

function SnapshotPanel({ snapshot }: { snapshot: WinbackBridgeResponse["snapshot"] }) {
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      {snapshot.remindersPaused && (
        <div style={{ marginBottom: 14 }}>
          <span className="chip">Reminder dispatch paused — tracking continues, no SMS/email is going out</span>
        </div>
      )}
      <div className="stat-grid">
        <MiniStat label="Total declined" n={snapshot.total} />
        <MiniStat label="Reminders sent" n={snapshot.remindersSent} />
        <MiniStat label="Pending" n={snapshot.pending} />
        <MiniStat label="Eligible now" n={snapshot.eligible} accent={snapshot.eligible > 0 ? "watch" : undefined} />
      </div>
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

// ------------------------------- attention lists ------------------------------

function AttentionList({
  title,
  subtitle,
  items,
  dateField,
  dateLabel,
  fmtDate,
  accent,
}: {
  title: string;
  subtitle: string;
  items: WinbackAttentionRow[];
  dateField: "declinedAt" | "offerExpiresAt";
  dateLabel: string;
  /** `fmtWhen` for a past date ("2h ago"), `fmtUntil` for a future one
   *  ("in 20h") — `declinedAt` is always past, `offerExpiresAt` is always
   *  future, so the caller picks the matching formatter rather than this
   *  component guessing from the value. */
  fmtDate: (iso?: string) => string;
  accent: "bad" | "watch";
}) {
  return (
    <div className="panel panel-scroll">
      <h3>
        {title} {items.length ? `(${items.length})` : ""}
      </h3>
      <p className="card-subtitle" style={{ marginTop: -4, marginBottom: 10 }}>
        {subtitle}
      </p>
      {items.length === 0 ? (
        <div className="empty">Nothing here right now.</div>
      ) : (
        items.map((it) => (
          <div className="event-row" key={it.jobId}>
            <span className="row-icon" style={{ background: "var(--bg-muted)" }}>
              <span className="dot" style={{ background: accent === "bad" ? "var(--danger)" : "var(--warn, #d97706)" }} />
            </span>
            <span className="row-msg wrap">
              <b>{it.customerName || it.jobName || `RO ${it.repairOrderNumber ?? "?"}`}</b>
              <span className="row-sub">
                {it.jobName ?? "—"} · {it.jobCategory ?? "GENERAL"} · {money(it.estimatedTotal, true)} · {dateLabel} {fmtDate(it[dateField] ?? undefined)}
              </span>
            </span>
          </div>
        ))
      )}
    </div>
  );
}
