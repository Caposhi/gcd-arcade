import { useEffect, useRef, useState } from "react";
import {
  fetchQboConversations,
  fetchQboConversation,
  sendQboAssistantMessage,
  type QboConversationMessage,
  type QboConversationSummary,
} from "../../lib/bff";

/**
 * The AI Report Assistant panel — shared across every redesigned GCD QBO Hub
 * page (Cash Sheet Sync, Financial Projections, AI Report Assistant,
 * Coworker Portal). Per the redesign brief, this is ONE ongoing conversation
 * reachable from any of those pages, not a fresh thread per page: switching
 * pages and coming back should find the same thread where it was left, with
 * a history of past threads and a "+ New chat" escape hatch.
 *
 * Unlike Call Transcripts' "Ask The Calls" (SSE, incremental chunks), this
 * bridges gcd-qbo-hub's own request/response chat endpoint — the hub runs a
 * multi-round Claude tool-use loop server-side and returns one full reply,
 * so the busy state is a plain "thinking" spinner, not a streaming cursor.
 *
 * `seed` lets a page hand this panel a question to ask on the user's behalf
 * (e.g. tapping a GCD Pal insight's suggested follow-up) — mirrors the hub's
 * own `?q=` auto-send pattern in AssistantChat.tsx. Bump `nonce` to trigger a
 * send even if `text` repeats the previous seed.
 */
export function AiChatPanel({ appId, seed }: { appId: string; seed?: { text: string; nonce: number } }) {
  const [conversations, setConversations] = useState<QboConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<QboConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSeedNonce = useRef<number | null>(null);

  // On mount: load the thread list and resume the most recently active one,
  // so returning to any QBO Hub page picks the conversation back up.
  useEffect(() => {
    let alive = true;
    fetchQboConversations(appId)
      .then((list) => {
        if (!alive) return;
        setConversations(list);
        if (list.length > 0) void openThread(list[0].id);
      })
      .catch(() => {
        /* no history yet, or the bridge isn't configured — start fresh, silently */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // A page-supplied seed (e.g. "Ask GCD Pal" on an insight) sends itself once
  // per nonce, regardless of whatever's currently typed in the box.
  useEffect(() => {
    if (!seed || seed.nonce === lastSeedNonce.current) return;
    lastSeedNonce.current = seed.nonce;
    sendText(seed.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.nonce]);

  async function openThread(id: string) {
    setConversationId(id);
    setLoadingThread(true);
    setError(null);
    try {
      const msgs = await fetchQboConversation(appId, id);
      setMessages(msgs);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingThread(false);
    }
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setInput("");
  }

  function send() {
    sendText(input);
  }

  function sendText(raw: string) {
    const text = raw.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text, createdAt: new Date().toISOString() }]);
    setSending(true);

    sendQboAssistantMessage(appId, conversationId, text)
      .then((res) => {
        setConversationId(res.conversationId);
        setMessages((prev) => [...prev, { role: "assistant", content: res.reply, createdAt: new Date().toISOString() }]);
        // A brand-new thread won't be in the list yet — refresh it so the
        // dropdown picks it up without waiting for a page remount.
        setConversations((prev) => (prev.some((c) => c.id === res.conversationId) ? prev : [{ id: res.conversationId, title: text.slice(0, 60), updatedAt: new Date().toISOString() }, ...prev]));
      })
      .catch((err) => setError(String(err)))
      .finally(() => setSending(false));
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>Ask GCD Pal</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
          {conversations.length > 0 && (
            <select
              className="text-input select-input"
              value={conversationId ?? ""}
              onChange={(e) => (e.target.value ? void openThread(e.target.value) : newChat())}
              style={{ maxWidth: 220 }}
            >
              <option value="">+ New chat</option>
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}
          {conversations.length === 0 && conversationId && (
            <button className="btn" onClick={newChat} disabled={sending}>
              + New chat
            </button>
          )}
        </div>
      </div>
      <div className="chat-log">
        {loadingThread ? (
          <div className="empty">Loading conversation…</div>
        ) : messages.length === 0 ? (
          <div className="empty">
            Ask about the books, operations, or anything across the hub's modules — e.g. "why is margin down this
            month?" or "which coworker questions are still open?"
          </div>
        ) : (
          messages.map((m, i) => (
            <div className={`chat-msg ${m.role}`} key={i}>
              <b>{m.role === "user" ? "You" : "GCD Pal"}</b>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))
        )}
        {sending && (
          <div className="chat-msg assistant">
            <b>GCD Pal</b>
            <div>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {error && <div className="empty">{error}</div>}
      <div className="field-row">
        <input
          className="text-input"
          placeholder="Ask about the books, ops, or anything across the hub…"
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
