/**
 * GCD QBO Hub — Coworker Portal ("Ask My Client"), redesigned (§ QBO Hub
 * redesign, phase 4 of 4 — the last of the original four modules). Same
 * visual language as the other three: GCD Pal insight bullets, real
 * snapshot/leaderboard data, a question board, and the shared AI chat
 * panel.
 *
 * Read-only, deliberately: asking a question, answering one, closing/
 * reopening it, and importing "Ask My Client" transactions from QuickBooks
 * are all real mutations the native page performs, none of which are
 * reachable from the Arcade bridge. Every question row links out to the
 * hub's own detail page (`/coworker-portal/[id]`) to actually act on it —
 * the shell's own "Open full app" button (wired at the tile level, not
 * this view) is the general-purpose escape hatch for everything else.
 */
import { useEffect, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchQboCoworkerPortal } from "../../lib/bff";
import { AiChatPanel } from "./AiChatPanel";
import { fmtWhen, money } from "./format";
import type { CoworkerPortalBridgeResponse, CwpQuestion, CwpStatusFilter, PalInsight } from "./types";

const STATUS_OPTIONS: { value: CwpStatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

const STATUS_ACCENT: Record<string, "watch" | "info" | "muted"> = {
  open: "watch",
  answered: "info",
  closed: "muted",
};

const ACCENT_COLOR: Record<"watch" | "info" | "muted", string> = {
  watch: "var(--warn, #d97706)",
  info: "var(--royal-blue)",
  muted: "var(--text-muted)",
};

export function CoworkerPortalView({ tile }: { tile: Tile }) {
  const [status, setStatus] = useState<CwpStatusFilter>("open");
  const [data, setData] = useState<CoworkerPortalBridgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState<{ text: string; nonce: number } | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchQboCoworkerPortal(tile.appId, status)
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => alive && setError(String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [tile.appId, status]);

  const askAbout = (prompt: string) => setSeed((prev) => ({ text: prompt, nonce: (prev?.nonce ?? 0) + 1 }));

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflowY: "auto", overflowX: "hidden" }}>
      <div>
        <FilterBar status={status} onChange={setStatus} />

        {data && data.insights.length > 0 && <InsightsStrip insights={data.insights} onAsk={askAbout} />}

        {error && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">Couldn't load the Coworker Portal — {error}.</div>
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
              <AssigneeLeaderboard items={data.assignedLeaderboard} />
              <QuestionBoard items={data.questions} status={status} />
            </div>
          </>
        )}

        <AiChatPanel appId={tile.appId} seed={seed} />
      </div>
    </div>
  );
}

// -------------------------------- filter bar ---------------------------------

function FilterBar({ status, onChange }: { status: CwpStatusFilter; onChange: (s: CwpStatusFilter) => void }) {
  return (
    <div className="panel" style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
      <label className="field-row" style={{ margin: 0, gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Status</span>
        <select className="text-input select-input" value={status} onChange={(e) => onChange(e.target.value as CwpStatusFilter)}>
          {STATUS_OPTIONS.map((o) => (
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

function SnapshotPanel({ snapshot }: { snapshot: CoworkerPortalBridgeResponse["snapshot"] }) {
  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center", marginBottom: 14 }}>
        <span className="chip">Manual: {snapshot.bySource.manual}</span>
        <span className="chip">Ask My Client: {snapshot.bySource.askMyClient}</span>
      </div>
      <div className="stat-grid">
        <MiniStat label="Open" n={snapshot.counts.open} />
        <MiniStat label="Answered" n={snapshot.counts.answered} />
        <MiniStat label="Closed" n={snapshot.counts.closed} />
        <MiniStat label="Unassigned (open)" n={snapshot.unassignedOpen} accent={snapshot.unassignedOpen > 0 ? "watch" : undefined} />
        <MiniStat
          label="Oldest open"
          n={snapshot.oldestOpenDays}
          unit="days"
          accent={snapshot.oldestOpenDays !== null && snapshot.oldestOpenDays >= 3 ? "watch" : undefined}
        />
        <MiniStat label="Avg response" n={snapshot.avgResponseHours} unit="hrs" />
      </div>
    </div>
  );
}

function MiniStat({ label, n, unit, accent }: { label: string; n: number | null; unit?: string; accent?: "bad" | "watch" }) {
  return (
    <div className="stat-card">
      <div className="lbl">{label}</div>
      <div className="val" style={accent === "bad" ? { color: "var(--danger)" } : accent === "watch" ? { color: "var(--warn, #d97706)" } : undefined}>
        {n === null ? "—" : unit ? `${n} ${unit}` : n}
      </div>
    </div>
  );
}

// --------------------------- assignee leaderboard -----------------------------

function AssigneeLeaderboard({ items }: { items: CoworkerPortalBridgeResponse["assignedLeaderboard"] }) {
  return (
    <div className="panel panel-scroll">
      <h3>Who&apos;s waiting on questions</h3>
      {items.length === 0 ? (
        <div className="empty">No open questions are assigned to anyone right now.</div>
      ) : (
        items.map((a) => (
          <div className="event-row" key={a.email}>
            <span className="row-msg wrap">
              <b>{a.email}</b>
            </span>
            <span className="badge warn">
              {a.openCount} open
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// ------------------------------- question board -------------------------------

function QuestionBoard({ items, status }: { items: CwpQuestion[]; status: CwpStatusFilter }) {
  return (
    <div className="panel panel-scroll">
      <h3>
        Questions {status === "all" ? "" : `— ${status}`} {items.length ? `(${items.length})` : ""}
      </h3>
      {items.length === 0 ? (
        <div className="empty">No {status === "all" ? "" : status} questions.</div>
      ) : (
        items.map((q) => <QuestionRow key={q.id} item={q} />)
      )}
    </div>
  );
}

function QuestionRow({ item }: { item: CwpQuestion }) {
  const accent = STATUS_ACCENT[item.status] ?? "muted";
  const txnBits = [
    item.qboTxnName,
    item.qboTxnAmount !== null ? money(item.qboTxnAmount, true) : null,
    item.qboTxnDate,
  ].filter(Boolean);

  const inner = (
    <>
      <span className="row-icon" style={{ background: "var(--bg-muted)" }}>
        <span className="dot" style={{ background: ACCENT_COLOR[accent] }} />
      </span>
      <span className="row-msg wrap">
        <b>{item.subject}</b>
        <span className="row-sub">
          {item.status} · asked by {item.askedByEmail}
          {item.assignedEmail ? ` → ${item.assignedEmail}` : " · unassigned"}
          {item.answerCount > 0 ? ` · ${item.answerCount} ${item.answerCount === 1 ? "answer" : "answers"}` : ""}
          {txnBits.length > 0 ? ` · ${txnBits.join(" · ")}` : ""}
        </span>
      </span>
      <span className="row-ts">{fmtWhen(item.createdAt)}</span>
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
