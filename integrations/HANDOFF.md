# Cross-repo integration handoff

You (the agent with access to all GCD repos) are finishing the wiring that lets
the **gcd-arcade** hub show live activity. The hub reads every backend over a
read-only `/console/*` contract. This folder is the **source of truth** for what
each backend needs. Everything here is read-only + fire-and-forget telemetry —
it must never alter business logic or throw into real code paths.

## Guardrails
- Do **not** re-add the endpoint files — `console.ts` / `console.js` are already
  installed in their repos. Only add the **milestone calls** below.
- Work on a feature branch per repo; deploy when done. Don't open PRs unless asked.
- Keep the exact event `kind`s and data field names — the hub views key off them.

## Status by repo

### caposhi/gcd-agents (GCD-SOCIAL) — ✅ done
Reference implementation. Nothing to do.

### german-car-depot-attribution — endpoint ✅ / milestones ⛏
- `apps/api/src/routes/console.ts` is installed and registered at root
  (`/console/*`); job **lanes** already stream from BullMQ `QueueEvents`.
- **TODO:** add the `consoleEmit("match", …)` and `consoleEmit("capi", …)` calls
  per **`attribution/MILESTONES.md`** so the trading-desk **tape** prints. Place
  `match` where revenue is attributed to an RO; `capi` where conversions are
  POSTed to Meta. Keep fields `{ amount, roId, campaign }` and `{ count, accepted }`.
- **Also check:** `/console/state` returns `revenue: 0` / `ROAS 0.00×` despite 1
  attributed conversion — verify the `AttributedConversion` revenue sum in the
  state query is pulling the right column.

### gcd-webhook — endpoint ✅ / milestones ⛏ (mostly)
- `console.js` is installed and `mountConsole(app, …)` is wired; `saveSMSMessage`
  already emits (`sms-inbox`).
- **TODO:** add the remaining `pushConsole(...)` calls per
  **`gcd-webhook/MILESTONES.md`** — one per program: `validation`, `inspections`,
  `winback`, `maintenance`, `next-service`, `email-audit`, `engagement`,
  `transcripts`, `marketing-bonus`. Each is a single fire-and-forget line at the
  noted function.

## Already handled (no action)
- Hub (`gcd-arcade`) front-end + BFF: deployed and consuming these feeds.
- `GCD_WEBHOOK_ADMIN_SECRET` is set on the BFF (link-out buttons work).
- `CONSOLE_TOKEN`s: optional; leave unset to keep `/console/*` open for v1.

## Verify after deploying each
```bash
# attribution tape:
curl -N "https://gcd-attribution-api.onrender.com/console/stream"   # trigger a run → match/capi frames
# a webhook program stream:
curl -N "https://gcd-webhook.onrender.com/console/stream?program=winback"
```
Frames should print as each program runs (some only fire on their cron schedule).
