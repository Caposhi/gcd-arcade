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
import { proxyState, proxyStream } from "./proxy.js";

const PORT = Number(process.env.PORT) || 8787;
const MANIFEST_TTL_MS = Number(process.env.MANIFEST_TTL_MS) || 60_000;

const app = express();
app.disable("x-powered-by");
app.use(cors()); // hub is private; CORS-open keeps dev (cross-origin) simple

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

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[gcd-arcade-bff] listening on :${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    `[gcd-arcade-bff] registry: ${REGISTRY.map((r) => `${r.id}=${r.baseUrl ?? "(unset)"}${r.enabled ? "" : " (disabled)"}`).join(", ")}`
  );
});
