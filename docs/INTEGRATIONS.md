# Integrations

Arcade consumes independently deployed services. Their repositories—not the
copies under `integrations/`—are authoritative for behavior and data.

| Registry ID | Repository/service boundary | Credentials used by BFF | Arcade use | Failure boundary |
|---|---|---|---|---|
| `gcd-social` | GCD Social / historically `caposhi/gcd-agents` | optional console token | manifest, state, SSE; agent view | offline tile or proxy 502 |
| `attribution` | German Car Depot Attribution API | optional console token | manifest, state, SSE; attribution view | offline tile or proxy 502 |
| `gcd-webhook` | automation/webhook service | optional console token; admin query secret | console, transcripts, win-back, transcript AI, admin link-outs | offline/404/502; PII and AI boundary |
| `gcd-qbo-hub` | QBO Hub | optional console token; bearer bridge secret | console, financial/cash-sheet/coworker views, QBO refresh, assistant | offline/404/502; finance, QBO, persistence, AI boundary |
| Render | hosting account | dashboard/repository access outside Git | static web and Node BFF | complete service outage or exposure |
| Browser storage | operator browser profile | none | settings, session boot marker, local view counters | local loss/staleness only |

Base URLs and credentials are configured through environment variables. The
default Social URL in `registry.ts` is a production-looking Render hostname;
safe local configuration must keep `GCD_SOCIAL_ENABLED=false`. Console tokens
are attached as both `?key=` and `x-console-token`; query values can appear in
upstream logs. QBO bridge credentials use `Authorization: Bearer`.

The `integrations/` tree is a reference/adaptation area:

- `attribution/console.ts` and `gcd-webhook/console.js` are paste-ready snapshots,
  not compiled or deployed here.
- `gcd-qbo-hub/console.reference.ts` explicitly mirrors external source and may
  drift.
- milestone files propose upstream instrumentation. They do not establish that
  it was merged, deployed, enabled, or remains compatible.

Before changing a contract, verify the current upstream code, owner, route,
payload, token policy, timeout, cost, retention, deployment order, and rollback
compatibility. Never send a credential between repositories; coordinate its
storage location and rotation through the private continuity register.

Owner placeholders for the private register: Arcade code owner; Render account
owner; one code/operations owner for each upstream; credential rotation owner;
AI-provider billing owner; incident contact. None is established in Git.

