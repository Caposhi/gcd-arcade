# Data model

This repository has no database, schema, ORM, migrations, queue, or durable
server-side store.

## Repository-owned runtime state

| Store | Shape/source | Lifetime | Sensitivity |
|---|---|---|---|
| Manifest cache | map of registry ID to manifest/null | BFF memory; TTL; lost on restart | app identities, links, topology |
| React state | tiles, snapshots, events, filters, chats | page/component lifetime | may contain business, finance, transcript, customer, or staff data |
| `sessionStorage` | key `booted` | browser session | low |
| `localStorage` | `gcd-arcade:settings` | browser origin until cleared | low |
| `localStorage` | agent/attribution save keys defined in `views/*/save.ts` | browser origin until cleared | derived counters; may become stale |

Shared types in `packages/shared/src/index.ts` define `ConsoleManifest`,
`ConsoleEvent`, `ConsoleState`, and `Tile`. `ConsoleState.data` and event data are
intentionally loose (`unknown`/index signature), so TypeScript does not enforce
upstream payload schemas. Specialized view types are consumer expectations, not
authoritative upstream schemas.

## Upstream data domains

Arcade displays or relays social publishing state, ad attribution metrics,
automation events, SMS/transcript metadata and content, win-back activity, QBO
financial reports, cash-sheet exceptions, coworker questions, and AI
conversations. Durable models, relationships, retention, migrations, backups,
and deletion rules for those domains live in the respective upstream systems
and were not verified here.

Contract changes require coordinated rollout: make upstream payloads backward
compatible, update shared/view types and defensive mapping, deploy the upstream,
then deploy Arcade. Record any temporary compatibility window and rollback order.

