/**
 * /console/* contract for german-car-depot-attribution (Fastify `apps/api`).
 *
 * DROP-IN: copy this file to `apps/api/src/routes/console.ts`, then register it
 * in your Fastify bootstrap (see INSTALL below). It is READ-ONLY and
 * fire-and-forget: nothing here may affect the app's real work.
 *
 * It exposes:
 *   GET /console/manifest  — static identity (matches the hub's expectations)
 *   GET /console/state     — compact snapshot (KPIs, data quality, funnel, jobs)
 *   GET /console/stream     — SSE: BullMQ job lifecycle + attribution/CAPI events
 *
 * The SSE shapes line up with the hub's "neon trading terminal" view:
 *   kinds: job:active | job:progress | job:completed | job:failed
 *          match (data: {amount, roId, campaign})
 *          capi  (data: {count, accepted})
 *
 * ─── INSTALL ──────────────────────────────────────────────────────────────
 * 1. Save as apps/api/src/routes/console.ts
 * 2. Register in your server build (wherever you build the Fastify instance):
 *        import { consoleRoutes } from "./routes/console";
 *        await app.register(consoleRoutes);
 * 3. Adapt the three TODO blocks to your real Prisma models / BullMQ queues.
 * 4. (Optional) set CONSOLE_TOKEN to gate access; set PUBLIC_WEB_URL to your
 *    Next.js dashboard for the hub's "Open full dashboard" button.
 * 5. Deploy. Verify:  curl https://gcd-attribution-api.onrender.com/console/state
 * ────────────────────────────────────────────────────────────────────────── */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { QueueEvents } from "bullmq";
import IORedis from "ioredis";
// TODO: adjust this import to however you expose Prisma in apps/api.
import { prisma } from "../db";

const MANIFEST = {
  id: "attribution",
  name: "Attribution Dashboard",
  tagline: "Meta Ads ↔ Tekmetric offline revenue attribution",
  description:
    "Matches leads to repair orders, attributes revenue to campaigns, and sends offline conversions to Meta.",
  theme: { palette: ["#0b1f3a", "#1877F2", "#42b72a"], style: "neon trading terminal", icon: "📊" },
  endpoints: { state: "/console/state", stream: "/console/stream" },
  externalUrl: process.env.PUBLIC_WEB_URL ?? null,
};

/** TODO: the 5 BullMQ queue names this app actually runs. The hub derives the
 *  lane labels from these, so the names you put here show up on screen. */
const QUEUE_NAMES = (process.env.CONSOLE_QUEUES?.split(",").map((s) => s.trim()).filter(Boolean)) ?? [
  "meta-stats-ingest",
  "lead-ro-match",
  "revenue-attribution",
  "capi-conversions",
  "data-quality-refresh",
];

// ── in-memory console ring buffer (so /state can show recent events and the
//    SSE stream can replay from ?since=). Bounded; never persisted. ──────────
interface ConsoleEvent {
  id: number;
  kind: string;
  message?: string;
  data?: unknown;
  createdAt: string;
}
const events: ConsoleEvent[] = [];
let seq = 0;
const subscribers = new Set<(e: ConsoleEvent) => void>();
function emit(kind: string, message?: string, data?: unknown) {
  const e: ConsoleEvent = { id: ++seq, kind, message, data: data ?? null, createdAt: new Date().toISOString() };
  events.push(e);
  if (events.length > 1000) events.shift();
  for (const fn of subscribers) {
    try {
      fn(e);
    } catch {
      /* never let telemetry break anything */
    }
  }
}

/**
 * Call this from your business code to print "trades" on the hub's tape — it is
 * fire-and-forget and safe to leave in hot paths. Export it so your attribution
 * and CAPI jobs can announce milestones:
 *
 *   import { consoleEmit } from "../routes/console";
 *   consoleEmit("match", `RO #${roId}`, { amount, roId, campaign });
 *   consoleEmit("capi", "batch sent", { count, accepted: true });
 */
export function consoleEmit(kind: string, message?: string, data?: unknown) {
  emit(kind, message, data);
}

// optional token gate (header x-console-token or ?key=)
function authorized(req: FastifyRequest): boolean {
  const token = process.env.CONSOLE_TOKEN;
  if (!token) return true;
  const got = (req.headers["x-console-token"] as string) || (req.query as Record<string, string>)?.key;
  return got === token;
}
function cors(reply: FastifyReply) {
  reply.header("access-control-allow-origin", "*");
  reply.header("access-control-allow-headers", "content-type,x-console-token");
}

export async function consoleRoutes(app: FastifyInstance) {
  // Wire BullMQ QueueEvents → console events. This IS the live "game view".
  const connection = new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
  const queueEvents: QueueEvents[] = [];
  for (const name of QUEUE_NAMES) {
    const qe = new QueueEvents(name, { connection });
    qe.on("active", ({ jobId }) => emit("job:active", `${name} active`, { name, jobId }));
    qe.on("progress", ({ jobId, data }) =>
      emit("job:progress", `${name} progress`, { name, jobId, progress: typeof data === "number" ? data : undefined })
    );
    qe.on("completed", ({ jobId }) => emit("job:completed", `${name} completed`, { name, jobId }));
    qe.on("failed", ({ jobId, failedReason }) => emit("job:failed", `${name} failed`, { name, jobId, failedReason }));
    queueEvents.push(qe);
  }
  app.addHook("onClose", async () => {
    await Promise.all(queueEvents.map((qe) => qe.close()));
    await connection.quit();
  });

  app.get("/console/manifest", async (_req, reply) => {
    cors(reply);
    return MANIFEST;
  });

  app.get("/console/state", async (req, reply) => {
    cors(reply);
    if (!authorized(req)) return reply.code(401).send({ error: "unauthorized" });

    // ── TODO: adapt these queries to your real Prisma models. The hub reads:
    //   kpis.{spend,revenue,roas,cac}, dataQuality.{matchRate,capiAcceptance},
    //   funnel.{leads,matched,attributed,conversions}, jobs[].{name,status,lastRunAt}
    let kpis = { spend: 0, revenue: 0, roas: 0, cac: 0 };
    let dataQuality: Record<string, number> | null = null;
    let funnel = { leads: 0, matched: 0, attributed: 0, conversions: 0 };
    try {
      // Example shapes — rename to your columns:
      const dq = await prisma.data_quality_metrics.findFirst({ orderBy: { date: "desc" } });
      if (dq) dataQuality = { matchRate: Number(dq.matchRate ?? 0), capiAcceptance: Number(dq.capiAcceptance ?? 0) };

      // const spendAgg = await prisma.meta_daily_stats.aggregate({ _sum: { spend: true }, where: last30d });
      // const revAgg   = await prisma.attributed_conversions.aggregate({ _sum: { revenue: true }, where: last30d });
      // kpis.spend = spendAgg._sum.spend ?? 0; kpis.revenue = revAgg._sum.revenue ?? 0;
      // kpis.roas = kpis.spend ? kpis.revenue / kpis.spend : 0;
      // kpis.cac  = conversions ? kpis.spend / conversions : 0;
      // funnel = { leads, matched, attributed, conversions };
    } catch (err) {
      app.log.warn({ err }, "console/state snapshot failed (non-fatal)");
    }

    return {
      id: "attribution",
      kpis,
      dataQuality,
      funnel,
      jobs: QUEUE_NAMES.map((name) => ({ name, status: "idle", lastRunAt: null })),
      externalUrl: MANIFEST.externalUrl,
      recentEvents: events.slice(-30),
    };
  });

  app.get("/console/stream", async (req, reply) => {
    if (!authorized(req)) return reply.code(401).send({ error: "unauthorized" });
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no",
    });
    reply.raw.write(": connected\n\n");

    const since = Number((req.query as Record<string, string>)?.since ?? 0) || 0;
    for (const e of events.filter((e) => e.id > since)) {
      reply.raw.write(`id: ${e.id}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
    }

    const onEvent = (e: ConsoleEvent) =>
      reply.raw.write(`id: ${e.id}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
    subscribers.add(onEvent);

    const ping = setInterval(() => reply.raw.write(": ping\n\n"), 20000);
    req.raw.on("close", () => {
      clearInterval(ping);
      subscribers.delete(onEvent);
    });
  });
}
