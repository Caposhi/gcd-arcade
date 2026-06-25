/**
 * /console/* contract for gcd-webhook (single-file Express, CommonJS).
 *
 * This ONE repo backs several hub tiles (Call Transcripts, SMS Inbox, and the
 * Automation Server programs), so the contract is MULTI-PROGRAM: every event
 * carries a `program` field and /console/stream accepts ?program= to filter.
 *
 * READ-ONLY + fire-and-forget. Telemetry must never break the app's real work.
 *
 * ─── INSTALL ──────────────────────────────────────────────────────────────
 * 1. Save as `console.js` next to server.js.
 * 2. Near the top of server.js (after `const app = express()` and after your
 *    state loaders / isAuthorized / REMINDERS_PAUSED are defined):
 *
 *        const { pushConsole, mountConsole } = require("./console");
 *        mountConsole(app, {
 *          loadDeclinedJobs,            // () => Promise<Record>
 *          loadMaintenanceReminders,    // () => Promise<Record>
 *          loadCompletedInspections,    // () => Promise<Record>
 *          redisGet,                    // (key) => Promise<any>
 *          SMS_INBOX_KEY,
 *          isAuthorized,                // () => boolean  (IG/GoTo auth, etc.)
 *          getRemindersPaused: () => REMINDERS_PAUSED,
 *        });
 *
 * 3. Sprinkle pushConsole(<program>, <kind>, <message>, <data>) at the
 *    milestones below (each is fire-and-forget; safe to leave in place):
 *
 *      runValidationsAndUpdateCustomer:  pushConsole("validation","zerobounce",`ZeroBounce ${priority}`,{email})
 *      handleCompletedRepairOrder:       pushConsole("inspections",status,`RO #${roNum}`,{repairOrderId})
 *      processDailyReminders:            pushConsole("winback","sms",`reminder → ${name}`,{jobId})
 *      processMaintenanceReminders:      pushConsole("maintenance",`stage:${stage.key}`,name,{reminderId})
 *      processNextServiceAppointments:   pushConsole("next-service","created",`${rule.service} ${dueDate}`,{ro})
 *      runMonthlyEmailAudit:             pushConsole("email-audit","removed",`${removed} bad emails`,{})
 *      /webhooks/sendgrid-events:        pushConsole("engagement",ev.event,email,{url})
 *      saveSMSMessage (both directions): pushConsole("sms-inbox",message.dir,message.text.slice(0,40),{phone})
 *      runNightlySync:                   pushConsole("transcripts","sync",`synced ${n} calls`,{})
 *      scripts/marketing-bonus:          pushConsole("marketing-bonus","update",`${rows} rows`,{})
 *
 * 4. (Optional) set CONSOLE_TOKEN to gate access.
 * 5. Deploy. Verify:  curl https://gcd-webhook.onrender.com/console/manifest
 * ────────────────────────────────────────────────────────────────────────── */

// ── console ring buffer (bounded, in-memory; the durable counts come from
//    Redis via the loaders in mountConsole) ─────────────────────────────────
const consoleEvents = [];
let consoleSeq = 0;
const subscribers = new Set();

function pushConsole(program, kind, message, data) {
  const e = {
    id: ++consoleSeq,
    program,
    kind,
    message,
    data: data || null,
    createdAt: new Date().toISOString(),
  };
  consoleEvents.push(e);
  if (consoleEvents.length > 1000) consoleEvents.shift();
  for (const fn of subscribers) {
    try {
      fn(e);
    } catch (_) {
      /* telemetry must never throw into real work */
    }
  }
  return e;
}

const CONSOLE_MANIFEST = {
  id: "gcd-webhook",
  name: "GCD Automation",
  tagline: "Webhooks, validation, compliance, win-back, transcripts & SMS",
  description:
    "A fleet of Tekmetric-driven automations plus the call-transcript DB and two-way SMS inbox.",
  theme: { palette: ["#1a1a2e", "#e94560", "#0f3460"], style: "control-room terminal", icon: "🛠️" },
  programs: [
    { id: "transcripts", name: "Call Transcripts", icon: "📞", externalUrl: "/api/admin/transcripts" },
    { id: "sms-inbox", name: "SMS Inbox", icon: "💬", externalUrl: "/admin/sms" },
    { id: "winback", name: "Declined-Job Win-Back", icon: "🎯" },
    { id: "maintenance", name: "DetectAuto Maintenance", icon: "🔧" },
    { id: "validation", name: "Customer Validation", icon: "✅" },
    { id: "inspections", name: "DVI Compliance", icon: "🔎" },
    { id: "email-audit", name: "Monthly Email Audit", icon: "📧" },
    { id: "next-service", name: "Next-Service Scheduler", icon: "🗓️" },
    { id: "engagement", name: "Engagement Tracking", icon: "📈" },
    { id: "marketing-bonus", name: "Marketing Bonus", icon: "💰" },
  ],
  endpoints: { state: "/console/state", stream: "/console/stream" },
};

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type,x-console-token");
}
function authorized(req) {
  const token = process.env.CONSOLE_TOKEN;
  if (!token) return true;
  const got = req.headers["x-console-token"] || req.query.key;
  return got === token;
}

/**
 * Register the three routes. `deps` supplies the app's existing Redis-backed
 * loaders so /console/state reflects real counts (file fallback on Render is
 * non-durable, so prefer the Redis-backed values).
 */
function mountConsole(app, deps) {
  const {
    loadDeclinedJobs,
    loadMaintenanceReminders,
    loadCompletedInspections,
    redisGet,
    SMS_INBOX_KEY,
    isAuthorized,
    getRemindersPaused,
  } = deps || {};

  app.get("/console/manifest", (req, res) => {
    cors(res);
    res.json(CONSOLE_MANIFEST);
  });

  app.get("/console/state", async (req, res) => {
    cors(res);
    if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
    try {
      const jobs = (loadDeclinedJobs && (await loadDeclinedJobs())) || {};
      const maint = (loadMaintenanceReminders && (await loadMaintenanceReminders())) || {};
      const inspections = (loadCompletedInspections && (await loadCompletedInspections())) || {};
      const inbox = (redisGet && SMS_INBOX_KEY && (await redisGet(SMS_INBOX_KEY))) || {};
      const j = Object.values(jobs);
      res.json({
        id: "gcd-webhook",
        programs: {
          winback: {
            total: j.length,
            remindersSent: j.filter((x) => x.reminderSent).length,
            pending: j.filter((x) => !x.reminderSent).length,
          },
          maintenance: { tracked: Object.keys(maint).length },
          inspections: { tracked: Object.keys(inspections).length },
          "sms-inbox": {
            threads: Object.keys(inbox).length,
            unread: Object.values(inbox).reduce((s, c) => s + (c.unread || 0), 0),
          },
          transcripts: { authorized: isAuthorized ? !!isAuthorized() : null },
        },
        remindersPaused: getRemindersPaused ? !!getRemindersPaused() : false,
        recentEvents: consoleEvents.slice(-30),
      });
    } catch (err) {
      // Fail soft — never 500 the hub.
      res.json({ id: "gcd-webhook", programs: {}, recentEvents: consoleEvents.slice(-30), error: String(err) });
    }
  });

  app.get("/console/stream", (req, res) => {
    if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "access-control-allow-origin": "*",
      "x-accel-buffering": "no",
    });
    res.write(": connected\n\n");

    const program = req.query.program || null; // optional single-view filter
    const since = Number(req.query.since || 0) || 0;
    const write = (e) => {
      if (program && e.program !== program) return;
      res.write(`id: ${e.id}\nevent: ${e.kind}\ndata: ${JSON.stringify(e)}\n\n`);
    };
    for (const e of consoleEvents.filter((e) => e.id > since)) write(e);

    subscribers.add(write);
    const ping = setInterval(() => res.write(": ping\n\n"), 20000);
    req.on("close", () => {
      clearInterval(ping);
      subscribers.delete(write);
    });
  });
}

module.exports = { pushConsole, mountConsole, CONSOLE_MANIFEST };
