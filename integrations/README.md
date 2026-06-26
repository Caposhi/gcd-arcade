# Connecting the backends (`/console/*`)

The hub reads every app over the same read-only `/console/*` contract. This
folder has **paste-ready implementations** for the two apps that still need it.
`gcd-social` already implements the contract (it's the reference) — nothing to
do there.

| App | Repo | File to add | Where it goes |
|---|---|---|---|
| GCD-SOCIAL | `caposhi/gcd-agents` | — (already done ✅) | — |
| Attribution | `german-car-depot-attribution` | [`attribution/console.ts`](./attribution/console.ts) | `apps/api/src/routes/console.ts` + register |
| GCD Automation | `gcd-webhook` | [`gcd-webhook/console.js`](./gcd-webhook/console.js) | `console.js` beside `server.js` + `mountConsole(app, …)` |

Each file has step-by-step INSTALL notes in its header comment. Both are
read-only, fire-and-forget, support an optional `CONSOLE_TOKEN`, and emit the
exact event shapes the hub's views expect.

### Making the live streams light up (milestone wiring)

The `/console/state` counts work as soon as the endpoints are installed, but the
**live event streams** (SMS/transcripts/automation activity; the attribution
match-tape) only flow once the apps *announce* milestones. Paste-ready one-liners,
mapped to each real function, are here:

- [`gcd-webhook/MILESTONES.md`](./gcd-webhook/MILESTONES.md) — `pushConsole(...)`
  per program (validation, inspections, win-back, maintenance, next-service,
  email-audit, engagement, transcripts, marketing-bonus; SMS already done).
- [`attribution/MILESTONES.md`](./attribution/MILESTONES.md) — `consoleEmit("match"|"capi", …)`
  in the attribution + CAPI jobs to drive the trading-desk tape.

> These changes live in the **backend repos**, not here — this is just the
> source of truth so they're easy to copy. (This session is scoped to
> `gcd-arcade`, so I can't push to those repos directly; see "How to apply".)

## How to apply

Two options:

1. **Paste-and-deploy (fastest):** copy each file into its repo per the INSTALL
   header, adapt the small `TODO` blocks (Attribution's Prisma queries + queue
   names), commit on a feature branch, deploy on Render.
2. **Let me push it:** open a Claude Code session that includes the backend repo
   (or grant the GitHub app access to it), and I'll add + push the endpoint on a
   feature branch there.

## Hosting the hub on Render

The hub is **already a Render Blueprint** — `render.yaml` at the repo root
defines both services. You don't hand-create a server; the blueprint does.

1. In Render: **New → Blueprint**, connect the `caposhi/gcd-arcade` repo, pick
   the branch (this feature branch now, or `main` after PR #1 merges).
2. Render reads `render.yaml` and creates **two services** (a *new* blueprint,
   separate from your other apps' blueprints, in the same account):
   - **`gcd-arcade-web`** — static site (the XMB front-end). **This URL is the
     hub** the team visits. Private + unguessable; no login in v1, so just don't
     share the URL publicly.
   - **`gcd-arcade-bff`** — Node web service (the aggregator that holds tokens).
     The web site rewrites `/api/*` to it, so the browser only ever uses the web
     URL.
3. No database. Set env (most are pre-filled in `render.yaml`):
   - `GCD_SOCIAL_URL = https://gcd-social-api.onrender.com`
   - `GCD_WEBHOOK_URL = https://gcd-webhook.onrender.com`
   - `ATTRIBUTION_URL = https://gcd-attribution-api.onrender.com`
   - optional `*_CONSOLE_TOKEN` (one per app, if you gate the endpoints)
   - optional `GCD_WEBHOOK_ADMIN_SECRET` (only to deep-link the `/admin/sms` and
     `/api/admin/transcripts` UIs with `?secret=`)

**So: yes — the deliverable is a single URL** (the `gcd-arcade-web` site).
Keep it private; share with the team only.

## Token gating (recommended for these)

The `/console/*` payloads expose business metrics (revenue, ROAS, counts), so
gating is sensible even though the hub URL is private. To enable per app:

1. Generate a random token, e.g. `openssl rand -hex 24`.
2. Set `CONSOLE_TOKEN=<value>` on the **backend** (it then requires the token).
3. Set the matching `*_CONSOLE_TOKEN` on the **hub BFF** (`GCD_SOCIAL_CONSOLE_TOKEN`,
   `ATTRIBUTION_CONSOLE_TOKEN`, `GCD_WEBHOOK_CONSOLE_TOKEN`). The BFF attaches it
   server-side; it never reaches the browser.

Leave both unset to keep an app's endpoints open for v1.

## What I need from you to finish wiring

1. Apply the two endpoints (option 1 or 2 above) and deploy each app.
2. Confirm each app's public base URL that serves `/console/*`:
   - social `https://gcd-social-api.onrender.com` · webhook
     `https://gcd-webhook.onrender.com` · attribution
     `https://gcd-attribution-api.onrender.com`
3. Decide token-gating (open vs `CONSOLE_TOKEN`); if gating, send me nothing —
   just set both sides as above.
4. Once live, paste a sample `/console/state` + a few `/console/stream` frames
   from attribution and the webhook so I can tighten the views' field mappings
   (attribution match/CAPI/funnel fields; webhook per-program buckets).

## Verifying an endpoint

```bash
curl -s https://gcd-attribution-api.onrender.com/console/manifest | jq .
curl -s https://gcd-attribution-api.onrender.com/console/state    | jq .
# stream (Ctrl-C to stop):
curl -N  https://gcd-attribution-api.onrender.com/console/stream
```

If gated, add `?key=<token>` or `-H "x-console-token: <token>"`.
