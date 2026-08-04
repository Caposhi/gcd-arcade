/**
 * Call Transcripts — plain dashboard, same visual language as Attribution
 * and Agents (stat-grid / panel / event-row / funnel-row, no bespoke world
 * chrome). Replaces the generic LiveView fallback (a raw KPI list + an
 * unfiltered event log dominated by "insight analysis finished (exit 0)")
 * with the actual business intelligence already sitting in call_insights
 * and nowhere else in any UI: complaint/service/vehicle breakdowns, a
 * follow-up queue, competitor mentions, pricing objections, full-text
 * search with call drill-in, and a chat panel over the real data.
 */
import { useEffect, useRef, useState } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { fetchState, fetchTranscripts, streamAiChat, type AiChatMessage } from "../../lib/bff";
import { useStream } from "../../lib/sse";
import { iconFor } from "../../lib/icons";
import { TranscriptsEngine, type ActivityItem, type Health } from "./engine";

// ------------------------------- data shapes --------------------------------

interface KV {
  k: string;
  n: number;
}
interface SearchResult {
  id: string;
  caller_number?: string;
  caller_name?: string;
  start_time?: string;
  duration_ms?: number;
  ai_summary?: string;
  ai_sentiment?: string;
  snippet?: string;
}
interface FollowUp {
  callId: string;
  reason?: string;
  purpose?: string;
  callerName?: string;
  callerNumber?: string;
  startTime?: string;
}
interface Competitor {
  name: string;
  n: number;
}
interface PricingMention {
  callId: string;
  caller?: string;
  at?: string;
  amount?: string;
  context?: string;
  comparison?: string;
  sentiment?: string;
}
interface InsightsSummary {
  complaintCategories: KV[];
  serviceTypes: KV[];
  vehicleBrands: KV[];
  followUpTotal: number;
  followUps: FollowUp[];
  competitors: Competitor[];
  pricingMentions: PricingMention[];
}
interface Utterance {
  id: number;
  text: string;
  start_ms?: number;
  channel_label?: string;
}
interface CallDetail {
  call: {
    caller_name?: string;
    caller_number?: string;
    start_time?: string;
    duration_ms?: number;
    ai_summary?: string;
    ai_sentiment?: string;
  };
  utterances: Utterance[];
}

// ------------------------------- formatting ----------------------------------

function fmtDuration(ms?: number): string {
  if (ms == null || ms < 0) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtWhen(iso?: string): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diffMin = Math.round((Date.now() - t) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)}h ago`;
  return new Date(t).toLocaleDateString();
}
function titleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function sentimentTone(s?: string): "pos" | "neu" | "neg" {
  const v = (s || "").toLowerCase();
  if (v === "positive") return "pos";
  if (v === "negative") return "neg";
  return "neu";
}
const TONE_COLOR: Record<"pos" | "neu" | "neg", string> = {
  pos: "var(--success)",
  neu: "var(--gray-400)",
  neg: "var(--danger)",
};

// -------------------------------- main view ----------------------------------

export function TranscriptsView({ tile }: { tile: Tile }) {
  const { events, status } = useStream(tile.appId, tile.program);
  const engineRef = useRef<TranscriptsEngine>(new TranscriptsEngine());
  const [health, setHealth] = useState<Health>(() => engineRef.current.getHealth());
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetchState(tile.appId)
        .then((s) => {
          if (!alive) return;
          engineRef.current.ingestState(s);
          setHealth(engineRef.current.getHealth());
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [tile.appId]);

  useEffect(() => {
    engineRef.current.ingestEvents(events);
    setActivity(engineRef.current.getActivity());
  }, [events]);

  const loadSummary = () => {
    setSummaryError(null);
    fetchTranscripts<InsightsSummary>(tile.appId, "insights-summary")
      .then(setSummary)
      .catch((err) => setSummaryError(String(err)));
  };
  useEffect(loadSummary, [tile.appId]);

  return (
    <div className="view-body" style={{ gridTemplateColumns: "1fr", overflow: "auto" }}>
      <div>
        <HealthStrip health={health} status={status} activity={activity} />

        {summaryError && (
          <div className="panel" style={{ marginBottom: 24 }}>
            <div className="empty">
              Couldn't load insight breakdowns — {summaryError}.{" "}
              <button className="btn-outline btn-sm" onClick={loadSummary}>
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="panel-grid" style={{ marginBottom: 24 }}>
          <FollowUpQueue items={summary?.followUps ?? []} total={summary?.followUpTotal} onOpen={setSelectedCallId} />
          <BreakdownPanel title="Complaints" rows={summary?.complaintCategories ?? []} color="var(--danger)" />
          <BreakdownPanel title="Service Type" rows={summary?.serviceTypes ?? []} color="var(--royal-blue)" />
          <BreakdownPanel title="Vehicle Brand" rows={summary?.vehicleBrands ?? []} color="var(--royal-blue)" />
        </div>

        <div className="two-col" style={{ marginBottom: 24 }}>
          <CompetitorRadar items={summary?.competitors ?? []} />
          <PricingObjections items={summary?.pricingMentions ?? []} onOpen={setSelectedCallId} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <SearchPanel appId={tile.appId} onOpen={setSelectedCallId} />
        </div>

        <AskThePanel appId={tile.appId} />
      </div>

      {selectedCallId && (
        <CallDrilldown appId={tile.appId} callId={selectedCallId} onClose={() => setSelectedCallId(null)} />
      )}
    </div>
  );
}

// ------------------------------ health strip ---------------------------------

function HealthStrip({ health, status, activity }: { health: Health; status: string; activity: ActivityItem[] }) {
  const { positive, neutral, negative } = health.sentiment;
  const sentimentTotal = positive + neutral + negative;
  const lastActivity = activity[0];
  const followUps = health.followUpCount ?? 0;

  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="lbl">Total calls</div>
        <div className="val">{health.totalCalls ?? "—"}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">Transcribed</div>
        <div className="val">{health.callsWithTranscript ?? "—"}</div>
      </div>
      <div className="stat-card">
        <div className="lbl">AI-analyzed</div>
        <div className="val accent">{health.analyzedCount != null ? `${health.analyzedCount}` : "—"}</div>
        {health.analyzedPct != null && <div className="val muted">{health.analyzedPct}% of transcribed</div>}
      </div>
      <div className="stat-card">
        <div className="lbl">Needs follow-up</div>
        <div className="val" style={followUps > 0 ? { color: "var(--danger)" } : undefined}>
          {health.followUpCount ?? "—"}
        </div>
      </div>
      <div className="stat-card">
        <div className="lbl">Sentiment mix</div>
        {sentimentTotal > 0 ? (
          <div className="sentiment-bar" title={`${positive} positive · ${neutral} neutral · ${negative} negative`}>
            <i style={{ flexGrow: positive || 0.0001, background: "var(--success)" }} />
            <i style={{ flexGrow: neutral || 0.0001, background: "var(--gray-300)" }} />
            <i style={{ flexGrow: negative || 0.0001, background: "var(--danger)" }} />
          </div>
        ) : (
          <div className="val muted">—</div>
        )}
      </div>
      <div className="stat-card">
        <div className="lbl">
          <span className={`statusdot ${status}`} /> Sync
        </div>
        <div className="val muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {lastActivity ? lastActivity.text : health.lastSyncedAt ? `synced ${fmtWhen(health.lastSyncedAt)}` : "waiting for first sync…"}
        </div>
      </div>
    </div>
  );
}

// ----------------------------- breakdown panels -------------------------------

function BreakdownPanel({ title, rows, color }: { title: string; rows: KV[]; color: string }) {
  // Every field here is a bounded enum (8-10 values max at the schema level),
  // so show all of them — a top-N cap would silently hide real categories
  // (e.g. "billing"/"warranty" complaints, "oil_change" service calls) with
  // no indication anything was cut, and it also let taller sibling panels
  // (the follow-up queue) stretch this one to match via CSS grid row-sizing.
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="panel">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <div className="empty">No data yet</div>
      ) : (
        rows.map((r) => (
          <div className="funnel-row" key={r.k}>
            <span className="stage" style={{ width: 96 }}>
              {titleCase(r.k)}
            </span>
            <div className="bar-track">
              <i style={{ width: `${(r.n / max) * 100}%`, background: color }} />
            </div>
            <span className="stage-value">{r.n}</span>
          </div>
        ))
      )}
    </div>
  );
}

function FollowUpQueue({ items, total, onOpen }: { items: FollowUp[]; total?: number; onOpen: (id: string) => void }) {
  const Icon = iconFor("phone-incoming");
  return (
    <div className="panel panel-scroll">
      <h3>Follow-up Queue {total ? `(${total})` : ""}</h3>
      {items.length === 0 ? (
        <div className="empty">Nothing pending — nice.</div>
      ) : (
        items.map((f) => (
          <button className="event-row event-row-btn" key={f.callId} onClick={() => onOpen(f.callId)}>
            <span className="row-icon">
              <Icon />
            </span>
            <span className="row-msg wrap">
              <b>{f.callerName || f.callerNumber || "Unknown caller"}</b>
              <span className="row-sub">{f.reason || f.purpose || "Follow-up needed"}</span>
            </span>
            <span className="row-ts">{fmtWhen(f.startTime)}</span>
          </button>
        ))
      )}
    </div>
  );
}

function CompetitorRadar({ items }: { items: Competitor[] }) {
  return (
    <div className="panel">
      <h3>Competitor Radar</h3>
      {items.length === 0 ? (
        <div className="empty">No competitor mentions detected</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {items.map((c) => (
            <span className="chip" key={c.name}>
              {c.name} · {c.n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PricingObjections({ items, onOpen }: { items: PricingMention[]; onOpen: (id: string) => void }) {
  const Icon = iconFor("dollar-sign");
  return (
    <div className="panel panel-scroll">
      <h3>Pricing Objections</h3>
      {items.length === 0 ? (
        <div className="empty">No pricing pushback logged</div>
      ) : (
        items.map((p, i) => (
          <button className="event-row event-row-btn" key={`${p.callId}-${i}`} onClick={() => onOpen(p.callId)}>
            <span className="row-icon">
              <Icon />
            </span>
            <span className="row-msg wrap">
              <b>{p.amount || "Price mentioned"}</b>
              <span className="row-sub">
                {p.context}
                {p.comparison ? ` — ${p.comparison}` : ""}
              </span>
            </span>
            <span className="row-ts">{fmtWhen(p.at)}</span>
          </button>
        ))
      )}
    </div>
  );
}

// ------------------------------- search panel ---------------------------------

function SearchPanel({ appId, onOpen }: { appId: string; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    setLoading(true);
    setError(null);
    fetchTranscripts<{ results: SearchResult[] }>(appId, "search", { q, sentiment, pageSize: 15 })
      .then((r) => setResults(r.results))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    run(); // seed with the most recent calls on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  return (
    <div className="panel">
      <h3>Search Transcripts</h3>
      <div className="field-row">
        <input
          className="text-input"
          placeholder="Search what customers said…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && run()}
        />
        <select className="text-input select-input" value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="">Any sentiment</option>
          <option value="positive">Positive</option>
          <option value="neutral">Neutral</option>
          <option value="negative">Negative</option>
        </select>
        <button className="btn" onClick={run} disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
      {error && <div className="empty">Search failed — {error}</div>}
      {results && results.length === 0 && !loading && <div className="empty">No matching calls</div>}
      {results &&
        results.map((r) => {
          // With an active search, the snippet is FTS5's <mark>-highlighted
          // match context — genuinely useful, show it. Browsing with no
          // query, the "snippet" is just the first 200 characters of the
          // transcript, which for a phone call is almost always the same
          // boilerplate greeting ("Thank you for calling...") on every row —
          // the AI summary is far more useful to scan there.
          const isRealMatch = !!r.snippet && r.snippet.includes("<mark");
          const preview = (isRealMatch ? r.snippet : r.ai_summary || r.snippet) ?? "";
          return (
            <button className="event-row event-row-btn" key={r.id} onClick={() => onOpen(r.id)}>
              <span className="dot" style={{ background: TONE_COLOR[sentimentTone(r.ai_sentiment)] }} />
              <span className="row-msg wrap">
                <b>{r.caller_name || r.caller_number || "Unknown caller"}</b>
                <span className="row-sub" dangerouslySetInnerHTML={{ __html: preview }} />
              </span>
              <span className="row-ts">
                {fmtWhen(r.start_time)} · {fmtDuration(r.duration_ms)}
              </span>
            </button>
          );
        })}
    </div>
  );
}

// -------------------------------- call drill-in --------------------------------

function CallDrilldown({ appId, callId, onClose }: { appId: string; callId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    fetchTranscripts<CallDetail>(appId, `call/${encodeURIComponent(callId)}`)
      .then(setDetail)
      .catch((err) => setError(String(err)));
  }, [appId, callId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <b>{detail?.call.caller_name || detail?.call.caller_number || "Call detail"}</b>
            {detail?.call.start_time && <span className="row-ts"> · {fmtWhen(detail.call.start_time)}</span>}
            {detail?.call.duration_ms != null && <span className="row-ts"> · {fmtDuration(detail.call.duration_ms)}</span>}
          </div>
          <button className="btn-outline btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="empty">Couldn't load this call — {error}</div>}
        {!detail && !error && <div className="empty">Loading transcript…</div>}
        {detail && (
          <>
            {detail.call.ai_summary && (
              <div className="modal-summary">
                <span className="dot" style={{ background: TONE_COLOR[sentimentTone(detail.call.ai_sentiment)] }} />
                {detail.call.ai_summary}
              </div>
            )}
            <div className="modal-transcript">
              {detail.utterances.length === 0 ? (
                <div className="empty">No transcript text stored for this call.</div>
              ) : (
                detail.utterances.map((u) => (
                  <div className={`utterance ${u.channel_label === "staff" ? "staff" : "caller"}`} key={u.id}>
                    <span className="utterance-who">{u.channel_label === "staff" ? "Staff" : "Caller"}</span>
                    <span>{u.text}</span>
                    <span className="row-ts">{fmtDuration(u.start_ms)}</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------- "ask the calls" chat --------------------------

function AskThePanel({ appId }: { appId: string }) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    const prior = messages;
    setMessages([...prior, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setSending(true);

    streamAiChat(appId, [...prior, { role: "user", content: text }], (chunk) => {
      setMessages((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + chunk };
        return copy;
      });
    })
      .catch((err) => setError(String(err)))
      .finally(() => setSending(false));
  };

  return (
    <div className="panel">
      <h3>Ask The Calls</h3>
      <div className="chat-log">
        {messages.length === 0 && (
          <div className="empty">
            Ask something like "how many customers complained about pricing this week?" — answers are grounded in
            the actual call transcripts.
          </div>
        )}
        {messages.map((m, i) => (
          <div className={`chat-msg ${m.role}`} key={i}>
            <b>{m.role === "user" ? "You" : "Assistant"}</b>
            <div>{m.content || (sending && i === messages.length - 1 ? "…" : "")}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <div className="empty">{error}</div>}
      <div className="field-row">
        <input
          className="text-input"
          placeholder="Ask a question about your calls…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={sending}
        />
        <button className="btn" onClick={send} disabled={sending || !input.trim()}>
          {sending ? "Thinking…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
