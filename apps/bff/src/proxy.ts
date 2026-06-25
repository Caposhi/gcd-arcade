/**
 * Per-app proxies: a JSON state proxy and an SSE pass-through. The browser only
 * ever talks to the BFF; tokens are attached here, server-side.
 */
import type { Request, Response } from "express";
import type { AppEntry } from "./registry.js";
import { consoleHeaders, consoleUrl, fetchState } from "./upstream.js";

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
