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

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no", // disable proxy buffering (nginx/Render)
  });
  res.write(": connected\n\n");

  const ctrl = new AbortController();
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    ctrl.abort();
  };
  req.on("close", cleanup);

  // Keep the downstream connection warm even if upstream is quiet.
  const ping = setInterval(() => {
    if (!closed) res.write(": ping\n\n");
  }, 20000);

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: "text/event-stream", ...consoleHeaders(entry) },
      signal: ctrl.signal,
    });
    if (!upstream.ok || !upstream.body) {
      res.write(`event: console:error\ndata: ${JSON.stringify({ app: entry.id, status: upstream.status })}\n\n`);
      return;
    }
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    while (!closed) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) res.write(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    if (!closed) {
      res.write(`event: console:error\ndata: ${JSON.stringify({ app: entry.id, message: String(err) })}\n\n`);
    }
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
