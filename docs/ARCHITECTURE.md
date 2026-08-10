# Architecture

## Ownership and lifecycle

The root npm workspace is the only active application. Build order is shared
types, BFF, then web. The web artifact is static; the BFF is a long-running Node
process. `integrations/` contains uncompiled examples for other repositories.

At BFF module load, `registry.ts` reads environment configuration. On request,
`server.ts` concurrently fetches enabled upstream manifests, caches results in
memory for 60 seconds by default, and `tiles.ts` maps them to UI tiles. Failed
manifest fetches become offline fallback tiles. No readiness endpoint confirms
upstream availability.

The browser gets tiles, polls state in selected views (typically 12 or 15
seconds), and consumes SSE through a reconnecting client with exponential
backoff and `since` resume cursors. Each viewer holds a separate BFF-to-upstream
SSE connection. BFF JSON fetches use 8-second timeouts; most QBO bridge work uses
110 seconds.

## Components

| Component | Entry point | Owns |
|---|---|---|
| Shared | `packages/shared/src/index.ts` | console and tile TypeScript shapes |
| BFF | `apps/bff/src/server.ts` | registry, aggregation, credential attachment, proxy allowlists, cache |
| Web | `apps/web/src/main.tsx` | launcher, settings, polling/SSE clients, specialized views |
| Upstreams | separate repositories | durable business data, jobs, queues, AI calls, source APIs |

## BFF routes

All routes are currently unauthenticated and CORS-open.

| Method/path | Behavior | Side effect or sensitivity |
|---|---|---|
| `GET /api/health` | process liveness and time | no upstream check |
| `GET /api/apps[?refresh=1]` | manifest aggregation; refresh may bypass cache | upstream reads |
| `GET /api/apps/:id/open[?program=]` | redirects to manifest link | may expose admin secret in destination URL |
| `GET /api/apps/:id/state` | proxies `/console/state` | business telemetry |
| `GET /api/apps/:id/stream[?since=&program=]` | relays `/console/stream` SSE | business events; one upstream connection per viewer |
| `GET /api/apps/:id/transcripts/*` | allow-listed transcript admin reads or one call ID | customer/call PII likely |
| `POST /api/apps/:id/transcripts/ai-chat` | streams upstream AI response | sends transcript-derived prompts; cost-bearing |
| `GET /api/apps/:id/winback[?window=]` | win-back insights | customer/service-sensitive |
| `GET /api/apps/:id/reporting` | QBO reporting bridge | financial data; may populate upstream cache |
| `POST /api/apps/:id/reporting` | forces QBO refresh | external call/state/cache effect |
| `GET /api/apps/:id/cash-sheet-sync` | cash-sheet snapshot and exceptions | financial/operational data |
| `GET /api/apps/:id/coworker-portal` | question-board snapshot | personnel/financial context |
| `GET /api/apps/:id/assistant` | conversation list/history | persisted business conversation data upstream |
| `POST /api/apps/:id/assistant` | starts/continues AI conversation | upstream persistence and AI cost |

Transcript GET forwarding only permits `search`, `keywords`, `keyword-groups`,
`stats`, `insights-status`, `insights-summary`, or `call/<single segment>`.
Reporting, cash-sheet, coworker, and win-back query parameters are allow-listed.
Application IDs are accepted generically, but a bridge succeeds only if the
selected registry entry has the required secret and the upstream implements it.

## Data flows and invariants

1. Upstream manifest -> BFF memory cache -> derived tiles -> browser launcher.
2. Upstream console state/events -> credentialed BFF fetch/SSE -> browser view.
3. Browser filters/search -> BFF allowlist -> upstream specialized read API -> UI.
4. Browser refresh/chat -> unauthenticated BFF POST -> credentialed upstream
   operation -> upstream-owned cache/conversation/AI provider.
5. Browser settings and gamified counters -> origin-scoped local storage only.

Invariants:

- Browser code must never receive console tokens or QBO bearer secrets.
- A failed upstream must not crash the launcher.
- `integrations/` examples must never be mistaken for deployed upstream source.
- Upstream repositories remain authoritative for their schemas, schedules,
  business behavior, access rules, retention, backups, and recovery.
- Any new proxy route needs a narrow method/path/parameter/body allowlist, a
  timeout, documented sensitivity/side effects, and Arcade-side authorization.

## Trust boundaries

The browser-to-BFF boundary is currently based only on URL reachability, not
identity. Render privacy is asserted by old prose but not encoded in this repo.
The BFF-to-upstream boundary uses optional console tokens, a query-string admin
secret for gcd-webhook, and a bearer bridge secret for QBO Hub. The BFF is
therefore a privilege concentrator. Its redirect-based admin link crosses the
server boundary by placing the secret in a browser-visible URL; it is not a
server-only secret after redirect.

