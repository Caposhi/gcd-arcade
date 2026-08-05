/**
 * Per-app proxies: a JSON state proxy and an SSE pass-through. The browser only
 * ever talks to the BFF; tokens are attached here, server-side.
 */
import type { Request, Response } from "express";
import type { AppEntry } from "./registry.js";
import { consoleHeaders, consoleUrl, fetchState } from "./upstream.js";

const FETCH_TIMEOUT_MS = 8000;

/** GET /api/apps/:id/state → proxies that app's /console/state. */
export async function proxyState(entry: AppEntry, req: Request, res: Response): Promise<void> {
  try {
    const state = await fetchState(entry);
    res.json(state);
  } catch (err) {
    // Fail soft: a down app must not crash the shell.
    res.status(502).json({ error: "upstream_unreachable", app: entry.id, message: String(err) });
  }
}

/**
 * GET /api/apps/:id/stream → SSE pass-through of the app's /console/stream.
 * Holds one upstream connection for this viewer and relays frames verbatim.
 * Supports ?since=<id> (resume cursor) and ?program=<id> (single sub-view).
 */
export async function proxyStream(entry: AppEntry, req: Request, res: Response): Promise<void> {
  const extra: Record<string, string> = {};
  if (typeof req.query.since === "string") extra.since = req.query.since;
  if (typeof req.query.program === "string") extra.program = req.query.program;
  const upstreamUrl = consoleUrl(entry, "/console/stream", extra);

  const ctrl = new AbortController();
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    ctrl.abort();
  };
  req.on("close", cleanup);

  // Connect upstream BEFORE committing to any response — writing the 200
  // SSE headers first (then discovering upstream is down) told the client
  // every reconnect attempt "succeeded" and immediately ended, which reset
  // its failure counter every time and left it stuck retrying forever
  // instead of ever reaching useStream's "consistently failing → offline"
  // threshold. A real non-2xx response here lets that counter actually
  // accumulate across genuine failures.
  let upstream: globalThis.Response;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: { accept: "text/event-stream", ...consoleHeaders(entry) },
      signal: ctrl.signal,
    });
  } catch (err) {
    if (!res.headersSent) res.status(502).json({ error: "upstream_unreachable", app: entry.id, message: String(err) });
    return;
  }
  if (!upstream.ok || !upstream.body) {
    if (!res.headersSent) res.status(upstream.status || 502).json({ error: "upstream_error", app: entry.id, status: upstream.status });
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no", // disable proxy buffering (nginx/Render)
  });
  res.write(": connected\n\n");

  // Keep the downstream connection warm even if upstream is quiet.
  const ping = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, 20000);

  try {
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(decoder.decode(value, { stream: true }));
    }
  } catch {
    // Connection dropped mid-stream — let the client's reconnect/status
    // logic handle it rather than injecting a fake event.
  } finally {
    clearInterval(ping);
    cleanup();
    if (!res.writableEnded) res.end();
  }
}

// ---------------------------------------------------------------------------
// Call Transcripts world — the /console/* contract only carries a cheap KPI
// snapshot (see gcd-webhook's console.js), so the bespoke transcripts view
// talks to gcd-webhook's existing /api/admin/transcripts/* API for anything
// interactive (search, call drill-in, keyword stats, the insights summary,
// AI chat). Both routes below inject entry.adminSecret server-side — the
// same trust boundary the tile's "Open ↗" link-out already uses in tiles.ts
// — so the secret never reaches the browser.
// ---------------------------------------------------------------------------

const TRANSCRIPTS_ALLOWED_SUBPATHS = new Set([
  "search",
  "keywords",
  "keyword-groups",
  "stats",
  "insights-status",
  "insights-summary",
]);

/** GET /api/apps/:id/transcripts/* → proxies gcd-webhook's read-only
 *  transcript admin GET routes. `subpath` may be e.g. "search" or
 *  "call/CALL_ID" — only the fixed allow-list above or a "call/..." path is
 *  forwarded, so this can't be used to reach arbitrary admin routes. */
export async function proxyTranscriptsGet(
  entry: AppEntry,
  subpath: string,
  query: Record<string, string>,
  res: Response
): Promise<void> {
  const clean = subpath.replace(/^\/+/, "");
  const isCallLookup = /^call\/[^/]+$/.test(clean);
  if (!entry.baseUrl || !entry.adminSecret || !(TRANSCRIPTS_ALLOWED_SUBPATHS.has(clean) || isCallLookup)) {
    res.status(404).json({ error: "not_available" });
    return;
  }
  const url = new URL(`/api/admin/transcripts/${clean}`, entry.baseUrl);
  url.searchParams.set("secret", entry.adminSecret);
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === "string" && v.length) url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), { headers: { accept: "application/json" }, signal: ctrl.signal });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (err) {
    res.status(502).json({ error: "upstream_unreachable", message: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// GCD QBO Hub bridges — gcd-qbo-hub has no session with the Arcade, so these
// use a standalone bearer secret (entry.bearerSecret) instead of the
// ?secret= convention the transcripts proxies above use, injected
// server-side, same trust boundary. Both are plain (slow) JSON calls, not
// SSE — the reporting bridge can trigger a live QBO Reports fetch on a cold
// cache, and the assistant bridge runs a multi-round Claude tool-use loop —
// so they share one long timeout rather than FETCH_TIMEOUT_MS.
// ---------------------------------------------------------------------------

const QBO_HUB_BRIDGE_TIMEOUT_MS = 110_000;

/** GET/POST /api/apps/:id/reporting?<filters> → proxies gcd-qbo-hub's
 *  Financial Projections reporting bridge (KPIs, charts, aging, GCD Pal
 *  insights). A plain, allow-listed query passthrough since every param is
 *  a known filter name. GET reads through the cache; POST ("Refresh from
 *  QuickBooks") forces a live QBO refetch on the hub side — same forwarding,
 *  just a different HTTP method, since the hub's route branches on it. */
const REPORTING_ALLOWED_PARAMS = new Set(["preset", "comparison", "method", "granularity", "start", "end"]);

export async function proxyQboReporting(
  entry: AppEntry,
  query: Record<string, string>,
  res: Response,
  httpMethod: "GET" | "POST" = "GET"
): Promise<void> {
  if (!entry.baseUrl || !entry.bearerSecret) {
    res.status(404).json({ error: "not_available" });
    return;
  }
  const url = new URL("/api/external/reporting", entry.baseUrl);
  for (const [k, v] of Object.entries(query)) {
    if (REPORTING_ALLOWED_PARAMS.has(k) && v) url.searchParams.set(k, v);
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), QBO_HUB_BRIDGE_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), {
      method: httpMethod,
      headers: { accept: "application/json", authorization: `Bearer ${entry.bearerSecret}` },
      signal: ctrl.signal,
    });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (err) {
    res.status(502).json({ error: "upstream_unreachable", message: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/apps/:id/assistant[?conversationId=] → conversation list or one
 *  conversation's message history, proxied from gcd-qbo-hub's bridge route. */
export async function proxyQboAssistantGet(entry: AppEntry, conversationId: string | undefined, res: Response): Promise<void> {
  if (!entry.baseUrl || !entry.bearerSecret) {
    res.status(404).json({ error: "not_available" });
    return;
  }
  const url = new URL("/api/external/assistant", entry.baseUrl);
  if (conversationId) url.searchParams.set("conversationId", conversationId);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), {
      headers: { accept: "application/json", authorization: `Bearer ${entry.bearerSecret}` },
      signal: ctrl.signal,
    });
    const body = await upstream.text();
    res.status(upstream.status).type("application/json").send(body);
  } catch (err) {
    res.status(502).json({ error: "upstream_unreachable", message: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/apps/:id/assistant { conversationId?, message } → runs one turn
 *  of the shared Arcade-side conversation and returns the reply. */
export async function proxyQboAssistantSend(
  entry: AppEntry,
  body: { conversationId?: string; message?: string },
  res: Response
): Promise<void> {
  if (!entry.baseUrl || !entry.bearerSecret) {
    res.status(404).json({ error: "not_available" });
    return;
  }
  const url = new URL("/api/external/assistant", entry.baseUrl);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), QBO_HUB_BRIDGE_TIMEOUT_MS);
  try {
    const upstream = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${entry.bearerSecret}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await upstream.text();
    res.status(upstream.status).type("application/json").send(text);
  } catch (err) {
    res.status(502).json({ error: "upstream_unreachable", message: String(err) });
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/apps/:id/transcripts/ai-chat → streams gcd-webhook's
 *  Claude-backed chat-over-transcripts SSE response straight through. */
export async function proxyTranscriptsAiChat(entry: AppEntry, messages: unknown, res: Response): Promise<void> {
  if (!entry.baseUrl || !entry.adminSecret) {
    res.status(404).json({ error: "not_available" });
    return;
  }
  const url = new URL("/api/admin/transcripts/ai-chat", entry.baseUrl);
  url.searchParams.set("secret", entry.adminSecret);

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  try {
    const upstream = await fetch(url.toString(), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify({ messages }),
    });
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ type: "error", message: `upstream ${upstream.status}` })}\n\n`);
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`);
  } finally {
    if (!res.writableEnded) res.end();
  }
}
