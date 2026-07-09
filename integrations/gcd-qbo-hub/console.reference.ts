/**
 * /console/* contract for gcd-qbo-hub (Next.js App Router route handlers).
 *
 * ⚠️  MIRROR / REFERENCE ONLY — NOT wired into gcd-arcade and NOT deployed.
 *     The real handlers live in the gcd-qbo-hub repo (that repo is the source
 *     of truth). This single annotated file reproduces them so the contract is
 *     easy to see from the hub side. If the two drift, gcd-qbo-hub wins.
 *
 * In gcd-qbo-hub these are three separate files (App Router = one route.ts per
 * path). Split this file on the "── FILE:" separators below:
 *
 *     src/app/console/manifest/route.ts
 *     src/app/console/state/route.ts
 *     src/app/console/stream/route.ts
 *
 * The `_shared` block below is factored out (e.g. src/app/console/_shared.ts)
 * and imported by all three; it's inlined here only for readability.
 *
 * Like every other GCD backend, this is READ-ONLY + fire-and-forget: telemetry
 * must never touch QBO or the database. It supports the same optional
 * CONSOLE_TOKEN gate (header `x-console-token` or `?key=`), and the SSE stream
 * is served from a bounded in-memory ring buffer, replayable via `?since=`.
 *
 * As a hub this backend is MULTI-MODULE: each event carries a `program` field
 * and /console/stream accepts `?program=` to filter to one module's view.
 * ────────────────────────────────────────────────────────────────────────── */

/* ══════════════════════════════════════════════════════════════════════════
 * ── FILE: src/app/console/_shared.ts
 *    Shared manifest, token gate, CORS, and the in-memory ring buffer.
 * ════════════════════════════════════════════════════════════════════════ */

/** `GET /console/manifest` payload — mirrors what the hub's tile builder and
 *  static fallback expect. `externalUrl` is the hub's own public web URL. */
export const CONSOLE_MANIFEST = {
  id: "gcd-qbo-hub",
  name: "GCD QBO Hub",
  tagline: "QuickBooks Online automations, reporting & portals",
  description:
    "Cash Sheet Sync (live) with Projections, AI Report Assistant & Coworker Portal to come.",
  theme: { palette: ["#0d1b2a", "#2ec4b6", "#e0fbfc"], style: "ledger control room", icon: "📒" },
  programs: [
    { id: "cash-sheet-sync", name: "Cash Sheet Sync", icon: "💵", externalUrl: "/cash-sheet-sync" },
    { id: "projections", name: "Financial Projections", icon: "📈" },
    { id: "assistant", name: "AI Report Assistant", icon: "🤖" },
    { id: "coworker-portal", name: "Coworker Portal", icon: "🧑‍🔧" },
  ],
  endpoints: { state: "/console/state", stream: "/console/stream" },
  externalUrl: process.env.PUBLIC_WEB_URL ?? null,
} as const;

// ── console ring buffer (bounded, in-memory; the durable module counts come
//    from the app's own stores, read live in /console/state) ─────────────────
export interface ConsoleEvent {
  id: number;
  /** the owning module, e.g. "cash-sheet-sync" */
  program: string;
  /** the SSE `event:` name, e.g. "sync:posted", "sync:error" */
  kind: string;
  message?: string;
  data?: unknown;
  createdAt: string;
}

// Next.js may spin up multiple route modules per lambda; stash the buffer on
// globalThis so all three handlers share one instance within a process.
interface ConsoleGlobal {
  events: ConsoleEvent[];
  seq: number;
  subscribers: Set<(e: ConsoleEvent) => void>;
}
const g = globalThis as unknown as { __qboConsole?: ConsoleGlobal };
const bus: ConsoleGlobal = (g.__qboConsole ??= { events: [], seq: 0, subscribers: new Set() });

/**
 * Call this from your business code to print activity on the hub's tape — it is
 * fire-and-forget and safe to leave in hot paths:
 *
 *   import { pushConsole } from "@/app/console/_shared";
 *   pushConsole("cash-sheet-sync", "sync:posted", `posted ${rowsPosted} rows`, { rowsPosted });
 */
export function pushConsole(program: string, kind: string, message?: string, data?: unknown): ConsoleEvent {
  const e: ConsoleEvent = {
    id: ++bus.seq,
    program,
    kind,
    message,
    data: data ?? null,
    createdAt: new Date().toISOString(),
  };
  bus.events.push(e);
  if (bus.events.length > 1000) bus.events.shift();
  for (const fn of bus.subscribers) {
    try {
      fn(e);
    } catch {
      /* telemetry must never throw into real work */
    }
  }
  return e;
}

export function recentEvents(n = 30): ConsoleEvent[] {
  return bus.events.slice(-n);
}

/** optional token gate (header x-console-token or ?key=) */
export function authorized(req: Request): boolean {
  const token = process.env.CONSOLE_TOKEN;
  if (!token) return true;
  const got = req.headers.get("x-console-token") || new URL(req.url).searchParams.get("key");
  return got === token;
}

/** CORS + JSON headers the hub's BFF expects. */
export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-console-token",
};

/* ══════════════════════════════════════════════════════════════════════════
 * ── FILE: src/app/console/manifest/route.ts
 * ════════════════════════════════════════════════════════════════════════ */

// import { CONSOLE_MANIFEST, CORS_HEADERS } from "../_shared";

export const dynamic = "force-dynamic"; // never statically cached

export async function GET() {
  return Response.json(CONSOLE_MANIFEST, { headers: CORS_HEADERS });
}

/* ══════════════════════════════════════════════════════════════════════════
 * ── FILE: src/app/console/state/route.ts
 *    Compact per-module snapshot. Shape is app-specific; the hub reads it
 *    loosely, so fields can grow without an arcade change.
 * ════════════════════════════════════════════════════════════════════════ */

// import { authorized, CORS_HEADERS, recentEvents } from "../_shared";
// export const dynamic = "force-dynamic";

export async function GET_state(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: CORS_HEADERS });
  }

  // ── TODO: read the real counts from the hub's own stores. Cash Sheet Sync is
  //    the only live module today; the others report setupRequired until built.
  let cashSheetSync = {
    lastSyncAt: null as string | null,
    rowsScanned: 0,
    rowsPosted: 0,
    rowsSkipped: 0,
    rowsError: 0,
    possibleDuplicates: 0,
    changedAfterPosting: 0,
    removedAfterPosting: 0,
    auditOnly: 0,
    awaitingQboMatch: 0,
    unknownPurpose: 0,
    setupRequired: false,
  };
  try {
    // e.g. cashSheetSync = await loadCashSheetSyncSummary();
  } catch {
    /* fail soft — never 500 the hub */
  }

  return Response.json(
    {
      id: "gcd-qbo-hub",
      environment: (process.env.QBO_ENVIRONMENT as "sandbox" | "live") ?? "sandbox",
      rolloutStage: process.env.ROLLOUT_STAGE ?? "cash-sheet-sync",
      modules: {
        "cash-sheet-sync": cashSheetSync,
      },
      recentEvents: recentEvents(30),
    },
    { headers: CORS_HEADERS }
  );
}

/* ══════════════════════════════════════════════════════════════════════════
 * ── FILE: src/app/console/stream/route.ts
 *    SSE from the in-memory ring buffer. Replay via ?since=<id>; filter to one
 *    module via ?program=<id>. Uses a ReadableStream (Next.js App Router).
 * ════════════════════════════════════════════════════════════════════════ */

// import { authorized, recentEvents } from "../_shared";
// (the ring buffer's `bus` is imported from _shared in the real file)
// export const dynamic = "force-dynamic";
// export const runtime = "nodejs"; // long-lived stream; not the edge runtime

export async function GET_stream(req: Request) {
  if (!authorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const program = url.searchParams.get("program"); // optional single-module filter
  const since = Number(url.searchParams.get("since") ?? 0) || 0;

  const encoder = new TextEncoder();
  let ping: ReturnType<typeof setInterval>;
  let unsubscribe = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const frame = (e: ConsoleEvent) => {
        if (program && e.program !== program) return;
        controller.enqueue(encoder.encode(`id: ${e.id}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`));
      };

      controller.enqueue(encoder.encode(": connected\n\n"));
      for (const e of recentEvents(1000).filter((e) => e.id > since)) frame(e);

      bus.subscribers.add(frame);
      unsubscribe = () => bus.subscribers.delete(frame);

      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* controller closed */
        }
      }, 20000);
    },
    cancel() {
      clearInterval(ping);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no",
    },
  });
}
