/**
 * GCD-ARCADE BFF — the backend-for-frontend aggregator.
 *
 * Responsibilities:
 *   - GET /api/apps             merged tile list from every app's manifest
 *   - GET /api/apps/:id/state   proxy that app's /console/state
 *   - GET /api/apps/:id/stream  SSE pass-through of /console/stream
 *   - GET /api/health           liveness
 *
 * The browser only ever talks to this service. App tokens live only here.
 */
import express from "express";
import cors from "cors";
import type { AppsResponse, ConsoleManifest } from "@gcd-arcade/shared";
import { REGISTRY, getReadyEntry } from "./registry.js";
import { fetchManifest } from "./upstream.js";
import { buildTiles } from "./tiles.js";
import {
  proxyState,
  proxyStream,
  proxyTranscriptsGet,
  proxyTranscriptsAiChat,
  proxyQboAssistantGet,
  proxyQboAssistantSend,
  proxyQboReporting,
} from "./proxy.js";

const PORT = Number(process.env.PORT) || 8787;
const MANIFEST_TTL_MS = Number(process.env.MANIFEST_TTL_MS) || 60_000;

const app = express();
app.disable("x-powered-by");
app.use(cors()); // hub is private; CORS-open keeps dev (cross-origin) simple
app.use(express.json()); // only the transcripts ai-chat proxy POSTs a body

// --- manifest cache -------------------------------------------------------
let manifestCache: { at: number; data: Record<string, ConsoleManifest | null> } | null = null;

async function getManifests(force = false): Promise<Record<string, ConsoleManifest | null>> {
  if (!force && manifestCache && Date.now() - manifestCache.at < MANIFEST_TTL_MS) {
    return manifestCache.data;
  }
  const data: Record<string, ConsoleManifest | null> = {};
  await Promise.all(
    REGISTRY.map(async (entry) => {
      if (!entry.enabled || !entry.baseUrl) {
        data[entry.id] = null;
        return;
      }
      try {
        data[entry.id] = await fetchManifest(entry);
      } catch {
        data[entry.id] = null; // offline → fallback identity in buildTiles
      }
    })
  );
  manifestCache = { at: Date.now(), data };
  return data;
}

// --- routes ---------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "gcd-arcade-bff", time: new Date().toISOString() });
});

app.get("/api/apps", async (req, res) => {
  try {
    const manifests = await getManifests(req.query.refresh === "1");
    const body: AppsResponse = { tiles: buildTiles(manifests), generatedAt: new Date().toISOString() };
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: "apps_failed", message: String(err) });
  }
});

// Resolve a program's admin link-out and 302-redirect with the admin secret
// injected server-side, so the secret never appears in the hub's page source.
app.get("/api/apps/:id/open", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  const program = typeof req.query.program === "string" ? req.query.program : undefined;
  try {
    const manifests = await getManifests();
    const m = manifests[entry.id];
    const prog = m?.programs?.find((p) => p.id === program);
    const raw = prog?.externalUrl ?? m?.externalUrl;
    if (!raw || !entry.baseUrl) {
      res.status(404).json({ error: "no_link", app: entry.id, program });
      return;
    }
    const url = new URL(raw, entry.baseUrl);
    if (entry.adminSecret && /\/(admin|api\/admin)\//.test(url.pathname)) {
      url.searchParams.set("secret", entry.adminSecret);
    }
    res.redirect(302, url.toString());
  } catch (err) {
    res.status(502).json({ error: "open_failed", message: String(err) });
  }
});

app.get("/api/apps/:id/state", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  await proxyState(entry, req, res);
});

app.get("/api/apps/:id/stream", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  await proxyStream(entry, req, res);
});

// Call Transcripts world: read-only passthrough to gcd-webhook's transcript
// admin API (search, call drill-in, keyword/insights stats) — see proxy.ts
// for the allow-list that keeps this from reaching arbitrary admin routes.
app.get("/api/apps/:id/transcripts/*", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  const subpath = (req.params as Record<string, string>)[0] ?? "";
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") query[k] = v;
  }
  await proxyTranscriptsGet(entry, subpath, query, res);
});

// Streams the Claude-backed "chat over your call transcripts" response.
app.post("/api/apps/:id/transcripts/ai-chat", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  await proxyTranscriptsAiChat(entry, req.body?.messages, res);
});

// GCD QBO Hub's redesigned Financial Projections page — KPIs, charts, aging,
// and GCD Pal insights for the active filters. See proxy.ts for why this
// isn't polled every 15s like /console/state: it can trigger a live QBO
// Reports fetch on a cold cache, so the view fetches on mount/filter-change
// rather than continuously.
app.get("/api/apps/:id/reporting", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") query[k] = v;
  }
  await proxyQboReporting(entry, query, res);
});

// "Refresh from QuickBooks" — forces a live QBO refetch on the hub side.
// No per-user role check happens here: the Arcade has no login of its own,
// so unlike the hub's own owner_admin/reviewer-gated button, this is open to
// anyone who can reach the Arcade at all — already the intended trust
// boundary (ownership/management only).
app.post("/api/apps/:id/reporting", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === "string") query[k] = v;
  }
  await proxyQboReporting(entry, query, res, "POST");
});

// GCD QBO Hub's shared AI Report Assistant conversation — one ongoing thread
// reachable from every redesigned QBO Hub page, with history of past threads.
// See proxy.ts for why this is a plain JSON bridge (not SSE) with its own
// bearer secret, distinct from the transcripts admin proxies above.
app.get("/api/apps/:id/assistant", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  const conversationId = typeof req.query.conversationId === "string" ? req.query.conversationId : undefined;
  await proxyQboAssistantGet(entry, conversationId, res);
});

app.post("/api/apps/:id/assistant", async (req, res) => {
  const entry = getReadyEntry(req.params.id);
  if (!entry) {
    res.status(404).json({ error: "unknown_or_offline_app", app: req.params.id });
    return;
  }
  await proxyQboAssistantSend(entry, req.body ?? {}, res);
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[gcd-arcade-bff] listening on :${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `[gcd-arcade-bff] registry: ${REGISTRY.map((r) => `${r.id}=${r.baseUrl ?? "(unset)"}${r.enabled ? "" : " (disabled)"}`).join(", ")}`
  );
});
