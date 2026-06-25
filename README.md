# GCD-ARCADE

A PS3/PSP **XMB (Cross-Media Bar)**–style retro "home screen" for German Car
Depot's internal software. A horizontal ribbon of glossy app tiles; scroll
left/right to pick a program, press Enter to open its own themed **live view**
that visualizes that program's real, live processes.

It is a **launcher + aggregator**, not a rewrite. Each backend stays in its own
repo and deploy; the hub reads from them over a small, read-only `/console/*`
contract and never owns their data or business logic.

```
gcd-arcade/
├── apps/
│   ├── web/      # React + Vite + TS — the XMB front-end (static site)
│   └── bff/      # Node + TS aggregator — the only thing that holds app tokens
├── packages/
│   └── shared/   # shared TS types for the /console contract + tile model
├── render.yaml   # static site (web) + web service (bff)
└── .env.example  # BFF environment
```

## What's built (foundation milestone)

- **Shared contract types** (`packages/shared`) — `ConsoleManifest`,
  `ConsoleState`, `ConsoleEvent`, and the hub's `Tile` model.
- **BFF** (`apps/bff`):
  - `GET /api/apps` — merges every app's `/console/manifest` into the ordered
    XMB tile list. Expands `gcd-webhook`'s `programs[]` into top-level **Call
    Transcripts** + **SMS Inbox** tiles plus an **Automation Server** tile that
    groups the remaining programs as sub-views.
  - `GET /api/apps/:id/state` — proxies an app's `/console/state` (token added
    server-side).
  - `GET /api/apps/:id/stream` — **SSE pass-through** of `/console/stream`,
    supporting `?since=` and `?program=`.
  - `GET /api/health` — liveness for Render.
  - Caches manifests (60s); a down app degrades to an **OFFLINE** tile instead
    of crashing the shell. Tokens never reach the browser.
- **XMB shell** (`apps/web`):
  - PlayStation-style **boot animation** (skippable, once per session).
  - Horizontal **ribbon** with keyboard/gamepad nav (← → / A D, Enter/↓ open,
    Esc/Backspace back), enlarging active tile, drop-down selection info with
    recent activity.
  - **Live tile badges** derived from `/console/state` (e.g. "awaiting approval",
    "ROAS 3.4×", "3 pending"); disabled apps show **INSERT COIN**.
  - Generic themed **live view** (snapshot + live event stream) wired to the SSE
    pass-through — works for every tile today; bespoke per-app "worlds" layer on
    top later. **Automation** drill-down sub-grid and **placeholder** cabinet.
  - Global layers: **CRT** scanlines, **sound** (WebAudio-synth nav blips +
    ambient music toggle, off by default), **TV mode**, settings panel — all
    persisted to `localStorage`.

## Develop

```bash
npm install
npm run dev          # builds shared types, then runs bff (:8787) + web (:5173)
```

The Vite dev server proxies `/api/*` → `http://localhost:8787` (the BFF), so the
browser talks to a single origin. Configure backend URLs in `apps/bff/.env`
(see `.env.example`).

> Note: in restricted-egress sandboxes, `*.onrender.com` may be blocked, so the
> BFF will show every tile as OFFLINE locally. That's expected — the shell still
> runs, and the BFF reaches the apps normally once deployed on Render.

```bash
npm run build        # typecheck + build all three packages
```

## Deploy (Render)

`render.yaml` defines two services in the same Render account as the other apps:

- **`gcd-arcade-bff`** (Node web service) — holds the backend URLs + optional
  per-app `CONSOLE_TOKEN`s. Set `ATTRIBUTION_URL` to the Fastify **API** host.
- **`gcd-arcade-web`** (static site) — builds `apps/web/dist`; rewrites `/api/*`
  to the BFF and all other paths to `index.html` (SPA). Private; share the URL
  with the team only.

## The `/console/*` contract (what each backend must expose)

Read-only, no secrets, CORS-open, fire-and-forget telemetry. GCD-SOCIAL
(`caposhi/gcd-agents`) is the reference implementation.

| App | `/console/*` status | Notes |
|---|---|---|
| `gcd-social` (GCD-SOCIAL) | ✅ implemented | reference; `agents[]`, SSE `agent:*`/`brief:*` |
| `german-car-depot-attribution` | ⛏ needs it | add a Fastify plugin; stream BullMQ `QueueEvents` |
| `gcd-webhook` | ⛏ needs it | multi-program; tag each event with `program`; build on existing SSE bus + Redis |

The endpoints:

- `GET /console/manifest` — static identity (`id`, `name`, `theme`, optionally
  `agents[]` or `programs[]`, `externalUrl`).
- `GET /console/state` — small app-specific JSON snapshot (+ recent events).
- `GET /console/stream` — SSE; `?since=<id>` resumes, `: ping` heartbeat. Multi-
  program backends include a `program` field and accept `?program=` to filter.

See the master build prompt for paste-ready skeletons for the Attribution and
Webhook repos (sections 3b/3c). Those changes live in their own repos — this
hub only reads from them.

## Guardrails

- Never modify the underlying apps' business logic — only the read-only
  `/console/*` endpoints.
- No secrets in the front-end or any `/console` payload. Tokens live only in the
  BFF env. Token *health* is fine to show; token *values* never.
- Each app stays independently deployable; the hub depends on them, not vice
  versa. A down/slow app degrades to an OFFLINE tile.
