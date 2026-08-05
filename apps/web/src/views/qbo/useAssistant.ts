import { useEffect, useRef, useState } from "react";
import {
  fetchQboConversations,
  fetchQboConversation,
  sendQboAssistantMessage,
  type QboConversationMessage,
  type QboConversationSummary,
} from "../../lib/bff";

/**
 * Shared state/actions for the AI Report Assistant's ONE ongoing conversation
 * (per the redesign brief — reachable from any QBO Hub page, with a history
 * of past threads). Factored out of the compact bottom `AiChatPanel` so the
 * dedicated full-page `AssistantView` can reuse the exact same logic with a
 * richer layout instead of a second, divergent copy of it.
 *
 * Unlike Call Transcripts' "Ask The Calls" (SSE, incremental chunks), this
 * bridges gcd-qbo-hub's own request/response chat endpoint — the hub runs a
 * multi-round Claude tool-use loop server-side and returns one full reply,
 * so `sending` is a plain "thinking" flag, not a streaming cursor.
 *
 * `seed` lets a page hand the assistant a question to ask on the user's
 * behalf (e.g. tapping a GCD Pal insight's suggested follow-up) — mirrors
 * the hub's own `?q=` auto-send pattern in AssistantChat.tsx. Bump `nonce` to
 * trigger a send even if `text` repeats the previous seed.
 */
export function useAssistant(appId: string, seed?: { text: string; nonce: number }) {
  const [conversations, setConversations] = useState<QboConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<QboConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        // thread list picks it up without waiting for a page remount.
        setConversations((prev) =>
          prev.some((c) => c.id === res.conversationId)
            ? prev
            : [{ id: res.conversationId, title: text.slice(0, 60), updatedAt: new Date().toISOString() }, ...prev]
        );
      })
      .catch((err) => setError(String(err)))
      .finally(() => setSending(false));
  }

  return {
    conversations,
    conversationId,
    messages,
    input,
    setInput,
    sending,
    loadingThread,
    error,
    openThread,
    newChat,
    send,
    sendText,
  };
}
