# GCD QBO Hub — `/console/*`

Unlike the other backends in this folder, **the `/console/*` endpoints already
ship inside the `gcd-qbo-hub` repo itself** — there's nothing to paste into that
app. It's a Next.js (App Router) project, so the contract lives as three route
handlers:

```
src/app/console/manifest/route.ts   → GET /console/manifest
src/app/console/state/route.ts      → GET /console/state
src/app/console/stream/route.ts     → GET /console/stream   (SSE)
```

[`console.reference.ts`](./console.reference.ts) in this folder is a **mirror**
of those three handlers, kept here only so the contract is easy to read from the
hub side. The source of truth is the `gcd-qbo-hub` repo — if the two ever drift,
that repo wins.

They follow the same rules as every other backend:

- **Read-only + fire-and-forget** — telemetry never touches QBO or the DB.
- **Optional `CONSOLE_TOKEN` gate** — same as gcd-webhook: send it as the
  `x-console-token` header or a `?key=` query param. Leave it unset to keep the
  endpoints open for v1.
- The SSE stream is served from an **in-memory ring buffer**, replayable via
  `?since=<id>`.

## How this renders in the hub

`gcd-qbo-hub` is a **multi-module hub**, so it comes across as **one grouping
tile** (the "ledger control room", 📒) whose children are the modules the
manifest advertises:

| Module | Icon | Status |
|---|---|---|
| Cash Sheet Sync | 💵 | live (deep-links to `/cash-sheet-sync`) |
| Financial Projections | 📈 | planned |
| AI Report Assistant | 🤖 | planned |
| Coworker Portal | 🧑‍🔧 | planned |

Picking the tile drills into a sub-grid of these modules; each opens its own
program-filtered live view. The list is manifest-driven — add a module in the
hub's manifest and it shows up here with no arcade change. A static fallback in
`apps/bff/src/tiles.ts` keeps the tile (and its modules) rendering as "OFFLINE"
even if the hub can't be reached.

## Wiring it on the BFF

The arcade already knows about this app via `apps/bff/src/registry.ts`. You just
set the base URL (and, if you gate it, the token) on the **`gcd-arcade-bff`**
service:

- `GCD_QBO_HUB_URL = https://gcd-qbo-hub.onrender.com` (its public web URL that
  serves `/console/*`)
- `GCD_QBO_HUB_CONSOLE_TOKEN =` — only if you set `CONSOLE_TOKEN` on the hub.
  The BFF attaches it server-side; it never reaches the browser.
- optional `GCD_QBO_HUB_ENABLED=false` to hide the tile.

Both are pre-declared in `render.yaml` (URL filled, token `sync: false`) and in
`.env.example` for local dev.

## Verifying the endpoint

```bash
curl -s https://gcd-qbo-hub.onrender.com/console/manifest | jq .
curl -s https://gcd-qbo-hub.onrender.com/console/state    | jq .
# stream (Ctrl-C to stop):
curl -N  https://gcd-qbo-hub.onrender.com/console/stream
```

If gated, add `?key=<token>` or `-H "x-console-token: <token>"`.
