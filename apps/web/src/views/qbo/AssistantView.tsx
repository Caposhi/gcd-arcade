/**
 * GCD QBO Hub — AI Report Assistant, redesigned (§ QBO Hub redesign, phase 3
 * of 4). Unlike Cash Sheet Sync/Financial Projections, this page's entire
 * purpose IS the assistant, so it gets the full-page treatment the hub's own
 * /assistant page has — a conversation sidebar + a full-height chat — rather
 * than the small bottom `AiChatPanel` every other redesigned page embeds.
 * Both share the exact same state/actions (useAssistant.ts) and therefore
 * the exact same ONE ongoing conversation: starting a thread here and
 * picking it up from Cash Sheet Sync's bottom panel (or vice versa) just
 * works.
 *
 * No new backend for this phase — it's the same /api/apps/:id/assistant
 * bridge Financial Projections' phase already shipped.
 */
import { useEffect, useRef } from "react";
import type { Tile } from "@gcd-arcade/shared";
import { Plus } from "lucide-react";
import { useAssistant } from "./useAssistant";
import { fmtWhen } from "./format";

const STARTER_PROMPTS = [
  "How did the last cash sheet sync go, and is anything waiting on me?",
  "Why is margin down this month, and what's driving it?",
  "Which coworker questions are still open?",
  "What technicians are under 60% utilization right now?",
];

export function AssistantView({ tile }: { tile: Tile }) {
  const a = useAssistant(tile.appId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [a.messages, a.sending]);

  return (
    <div className="view-body qbo-assistant-body">
      <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h3>Conversations</h3>
        <button className="btn ghost" onClick={a.newChat} style={{ marginBottom: 12, justifyContent: "flex-start", gap: 8 }}>
          <Plus size={15} aria-hidden /> New chat
        </button>
        <div className="convo-list assistant-fill" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          {a.conversations.length === 0 ? (
            <div className="empty">No conversations yet.</div>
          ) : (
            a.conversations.map((c) => {
              const active = c.id === a.conversationId;
              return (
                <button
                  key={c.id}
                  className="event-row-btn"
                  onClick={() => a.openThread(c.id)}
                  style={{ display: "block", background: active ? "var(--powder-blue-100)" : undefined }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? "var(--royal-blue)" : "var(--text-strong)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.title}
                  </div>
                  <div className="row-sub">{fmtWhen(c.updatedAt)}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <h3>AI Report Assistant</h3>
        <div className="chat-log assistant-fill">
          {a.loadingThread ? (
            <div className="empty">Loading conversation…</div>
          ) : a.messages.length === 0 ? (
            <div style={{ padding: "12px 0" }}>
              <p className="empty" style={{ padding: "0 0 14px" }}>
                Ask about the books, operations, or anything across the hub's modules — Cash Sheet Sync, Financial
                Reporting, Tekmetric Operations, Deposit Reconciliation, Check Reception, and the Coworker Portal.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {STARTER_PROMPTS.map((p) => (
                  <button key={p} className="chip" style={{ cursor: "pointer", border: "none" }} onClick={() => a.sendText(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            a.messages.map((m, i) => (
              <div className={`chat-msg ${m.role}`} key={i}>
                <b>{m.role === "user" ? "You" : "GCD Pal"}</b>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))
          )}
          {a.sending && (
            <div className="chat-msg assistant">
              <b>GCD Pal</b>
              <div>Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {a.error && <div className="empty">{a.error}</div>}
        <div className="field-row" style={{ marginBottom: 0, marginTop: 14 }}>
          <input
            className="text-input"
            placeholder="Ask about the books, ops, or anything across the hub…"
            value={a.input}
            onChange={(e) => a.setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && a.send()}
            disabled={a.sending}
          />
          <button className="btn" onClick={a.send} disabled={a.sending || !a.input.trim()}>
            {a.sending ? "Thinking…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}
