# Environment

`.env.example` is the safe local template. The BFF does not load dotenv itself;
variables must be exported or injected by the runtime. `VITE_*` values are
compiled into the web bundle. `render.yaml` is intended deployment configuration
but does not prove live values.

## Active variables

| Variable | Consumer | Default/required behavior | Safety note |
|---|---|---|---|
| `PORT` | BFF | `8787` | hosting normally injects it |
| `MANIFEST_TTL_MS` | BFF | `60000`; invalid/zero falls back | process-local cache only |
| `GCD_SOCIAL_URL` | BFF | hardcoded Render URL if empty | production-looking default; disable locally |
| `ATTRIBUTION_URL` | BFF | unset | required when enabled |
| `GCD_WEBHOOK_URL` | BFF | unset | required when enabled |
| `GCD_QBO_HUB_URL` | BFF | unset | required when enabled |
| `GCD_SOCIAL_ENABLED` | BFF | true | set false for safe local use |
| `ATTRIBUTION_ENABLED` | BFF | true | set false for safe local use |
| `GCD_WEBHOOK_ENABLED` | BFF | true | set false for safe local use |
| `GCD_QBO_HUB_ENABLED` | BFF | true | set false for safe local use |
| `GCD_SOCIAL_CONSOLE_TOKEN` | BFF | optional | secret; must match upstream |
| `ATTRIBUTION_CONSOLE_TOKEN` | BFF | optional | secret; must match upstream |
| `GCD_WEBHOOK_CONSOLE_TOKEN` | BFF | optional | secret; must match upstream |
| `GCD_QBO_HUB_CONSOLE_TOKEN` | BFF | optional | secret; must match upstream |
| `GCD_WEBHOOK_ADMIN_SECRET` | BFF | optional; specialized routes unavailable without it | query-secret and browser redirect exposure risk |
| `GCD_QBO_HUB_BRIDGE_SECRET` | BFF | optional; specialized routes unavailable without it | bearer secret; grants bridge access |
| `VITE_BFF_URL` | web build | empty means same origin | public build-time URL, never a secret |
| `BFF_PROXY_TARGET` | Vite dev config | `http://localhost:8787` | development only |

Variables found only in `integrations/` reference code—`CONSOLE_TOKEN`,
`CONSOLE_QUEUES`, `PUBLIC_WEB_URL`, `REDIS_URL`, `QBO_ENVIRONMENT`, and
`ROLLOUT_STAGE`—are not active Arcade runtime variables and do not belong in
the root `.env.example`. Document them in their authoritative upstream repos.

When adding or removing an active read, update `.env.example`, this table,
`render.yaml` where appropriate, security/operations docs, and the private
continuity register. Keep placeholders fictional and integrations disabled.

