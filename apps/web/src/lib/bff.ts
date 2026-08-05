/** Thin client for the BFF. The browser never talks to backends directly. */
import type { AppsResponse, ConsoleState } from "@gcd-arcade/shared";
import type { ReportingBridgeResponse } from "../views/qbo/types";

const BASE = (import.meta.env.VITE_BFF_URL ?? "").replace(/\/$/, "");

function url(path: string): string {
  return `${BASE}${path}`;
}

export async function fetchApps(): Promise<AppsResponse> {
  const res = await fetch(url("/api/apps"));
  if (!res.ok) throw new Error(`/api/apps ${res.status}`);
  return (await res.json()) as AppsResponse;
}

export async function fetchState(appId: string): Promise<ConsoleState> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/state`));
  if (!res.ok) throw new Error(`/api/apps/${appId}/state ${res.status}`);
  return (await res.json()) as ConsoleState;
}

/** Resolve a tile's link-out href: absolute URLs pass through; relative BFF
 *  paths (e.g. the /open redirect) are resolved against the BFF base. */
export function externalHref(externalUrl: string): string {
  return externalUrl.startsWith("/") ? `${BASE}${externalUrl}` : externalUrl;
}

/** Build the SSE URL for a tile's stream (optionally filtered by program,
 *  optionally resuming after a cursor id). */
export function streamUrl(appId: string, program?: string, since?: number): string {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/stream`), window.location.origin);
  if (program) u.searchParams.set("program", program);
  if (since) u.searchParams.set("since", String(since));
  return u.toString();
}

// --------------------------- Call Transcripts world -------------------------
// Read-only reads (search, call drill-in, insights) hit gcd-webhook's own
// transcript admin API through a thin BFF passthrough (see apps/bff proxy.ts)
// rather than the generic /console/state contract, since these are
// request/response lookups, not a poll-every-15s snapshot.

/** GET /api/apps/:id/transcripts/<subpath>?<params> */
export async function fetchTranscripts<T>(
  appId: string,
  subpath: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/transcripts/${subpath}`), window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`/transcripts/${subpath} ${res.status}`);
  return (await res.json()) as T;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

// --------------------------- GCD QBO Hub world -------------------------

/** GET /api/apps/:id/reporting?<filters> — Financial Projections' KPIs,
 *  charts, aging, and GCD Pal insights for the active filters. Not polled —
 *  the view fetches on mount and whenever a filter changes (see proxy.ts:
 *  this can trigger a live QBO Reports fetch on a cold cache). */
export async function fetchQboReporting(
  appId: string,
  filters: Partial<Record<"preset" | "comparison" | "method" | "granularity" | "start" | "end", string>>
): Promise<ReportingBridgeResponse> {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/reporting`), window.location.origin);
  for (const [k, v] of Object.entries(filters)) {
    if (v) u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`/reporting ${res.status}`);
  return (await res.json()) as ReportingBridgeResponse;
}

/** POST /api/apps/:id/reporting?<filters> — "Refresh from QuickBooks": forces
 *  a live QBO refetch on the hub side (bypassing its cache) instead of the
 *  normal fetch-through-cache GET. Same response shape. */
export async function refreshQboReporting(
  appId: string,
  filters: Partial<Record<"preset" | "comparison" | "method" | "granularity" | "start" | "end", string>>
): Promise<ReportingBridgeResponse> {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/reporting`), window.location.origin);
  for (const [k, v] of Object.entries(filters)) {
    if (v) u.searchParams.set(k, v);
  }
  const res = await fetch(u.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`/reporting refresh ${res.status}`);
  return (await res.json()) as ReportingBridgeResponse;
}

// The redesigned QBO Hub pages share ONE ongoing AI Report Assistant
// conversation across all of them (per the redesign brief), with a history
// of past threads — bridged through gcd-qbo-hub's /api/external/assistant
// route (see apps/bff proxy.ts). Unlike Call Transcripts' chat, this is a
// plain request/response JSON call, not SSE: the hub runs a multi-round
// Claude tool-use loop that can take a while, so callers should show a busy
// state rather than expecting incremental chunks.

export interface QboConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface QboConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

/** GET /api/apps/:id/assistant — the shared conversation history list. */
export async function fetchQboConversations(appId: string): Promise<QboConversationSummary[]> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/assistant`));
  if (!res.ok) throw new Error(`/assistant ${res.status}`);
  const data = (await res.json()) as { conversations: QboConversationSummary[] };
  return data.conversations;
}

/** GET /api/apps/:id/assistant?conversationId= — one thread's messages. */
export async function fetchQboConversation(appId: string, conversationId: string): Promise<QboConversationMessage[]> {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/assistant`), window.location.origin);
  u.searchParams.set("conversationId", conversationId);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`/assistant ${res.status}`);
  const data = (await res.json()) as { messages: QboConversationMessage[] };
  return data.messages;
}

/** POST /api/apps/:id/assistant { conversationId?, message } → { conversationId, reply }.
 *  Omit conversationId to start a new thread. */
export async function sendQboAssistantMessage(
  appId: string,
  conversationId: string | null,
  message: string
): Promise<{ conversationId: string; reply: string }> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/assistant`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ conversationId: conversationId ?? undefined, message }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error === "not_configured" ? "The assistant isn't configured yet." : data.error || `assistant ${res.status}`);
  }
  return data as { conversationId: string; reply: string };
}

/** POST /api/apps/:id/transcripts/ai-chat, consuming the SSE stream as it
 *  arrives. `onChunk` receives each decoded text delta; resolves when the
 *  stream ends (the upstream sends a {type:'done'} frame, or the connection
 *  simply closes). */
export async function streamAiChat(
  appId: string,
  messages: AiChatMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/transcripts/ai-chat`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) throw new Error(`ai-chat ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        const obj = JSON.parse(line.slice(5).trim());
        if (obj.type === "text" && typeof obj.text === "string") onChunk(obj.text);
        else if (obj.type === "error") throw new Error(obj.message || "ai-chat error");
      } catch {
        /* ignore malformed frames — never let one bad chunk kill the stream */
      }
    }
  }
}
