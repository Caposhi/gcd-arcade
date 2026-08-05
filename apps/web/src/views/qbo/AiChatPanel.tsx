import { useEffect, useRef } from "react";
import { useAssistant } from "./useAssistant";

/**
 * The AI Report Assistant panel — shared across every redesigned GCD QBO Hub
 * page (Cash Sheet Sync, Financial Projections, AI Report Assistant,
 * Coworker Portal). Per the redesign brief, this is ONE ongoing conversation
 * reachable from any of those pages, not a fresh thread per page: switching
 * pages and coming back should find the same thread where it was left, with
 * a history of past threads and a "+ New chat" escape hatch.
 *
 * State/actions live in useAssistant.ts, shared with the dedicated full-page
 * AssistantView so the two presentations of the same conversation can never
 * drift into divergent behavior.
 */
export function AiChatPanel({ appId, seed }: { appId: string; seed?: { text: string; nonce: number } }) {
  const a = useAssistant(appId, seed);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [a.messages, a.sending]);

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Ask GCD Pal</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          {a.conversations.length > 0 && (
            <select
              className="text-input select-input"
              value={a.conversationId ?? ""}
              onChange={(e) => (e.target.value ? void a.openThread(e.target.value) : a.newChat())}
              style={{ maxWidth: 220 }}
            >
              <option value="">+ New chat</option>
              {a.conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          {a.conversations.length === 0 && a.conversationId && (
            <button className="btn" onClick={a.newChat} disabled={a.sending}>
              + New chat
            </button>
          )}
        </div>
      </div>
      <div className="chat-log">
        {a.loadingThread ? (
          <div className="empty">Loading conversation…</div>
        ) : a.messages.length === 0 ? (
          <div className="empty">
            Ask about the books, operations, or anything across the hub's modules — e.g. "why is margin down this
            month?" or "which coworker questions are still open?"
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
      <div className="field-row">
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
  );
}
