# Operations

## Health and diagnosis

1. Check `GET /api/health`. A 200 proves only that Express can answer.
2. Check `GET /api/apps`; inspect `generatedAt`, enabled state, and `online`.
3. If one app is offline, verify its enable flag, base URL, token pairing,
   `/console/manifest`, DNS/TLS, and the 8-second BFF timeout.
4. If snapshots work but live events do not, verify `/console/stream`, proxy
   buffering, heartbeats, program filters, and reconnect cursor behavior.
5. If specialized views return 404, verify the corresponding admin/bearer secret
   and upstream bridge exists. Never log or paste the secret.
6. If every browser request fails, verify the built-in `VITE_BFF_URL`; it is
   compiled into the static artifact, not read dynamically at runtime.

The BFF logs startup port and configured base URLs. It has no structured
request/error metrics, alert rules, trace IDs, readiness check, or checked-in
monitoring configuration. Upstream error bodies are passed through and should
be reviewed for accidental detail exposure.

## Jobs and schedules

Arcade defines no cron jobs, queues, workers, or maintenance scripts. Browser
poll timers (12/15 seconds), SSE reconnect timers, BFF SSE heartbeats (20
seconds), fetch timeouts, and manifest TTL are runtime timers—not scheduled
business jobs. All displayed jobs and their cadence/enabled gates are owned by
the upstream repositories and must be verified there. `integrations/*MILESTONES.md`
contains implementation suggestions, not proof of deployed schedules.

## Deployment

`render.yaml` intends:

- `gcd-arcade-bff`: Node web service; installs dependencies, builds shared and
  BFF, starts `@gcd-arcade/bff`, and uses `/api/health`.
- `gcd-arcade-web`: static service; installs dependencies, builds shared and
  web, publishes `apps/web/dist`, and rewrites all static-site paths to
  `/index.html` for SPA fallback.

The browser calls the BFF directly through `VITE_BFF_URL`; `render.yaml` does
not configure a web-site `/api` reverse proxy. Confirm the actual BFF URL after
service creation. Before deployment, verify Node 22, all required secrets,
explicit service privacy/access control, an allowed-origin policy, deploy owner,
and rollback rights in Render. None was verified in this audit.

## Incident response

For suspected exposure or misuse:

1. Restrict public access at the hosting layer, preserving evidence.
2. Identify affected BFF routes, time window, upstreams, and logs without copying
   customer or financial payloads into public systems.
3. Rotate impacted upstream credentials provider-side. Removing a value from Git
   or Render alone does not invalidate it.
4. Review browser histories, access logs, and referrers if the admin link-out was
   used because its query-string secret reaches the browser.
5. Confirm upstream data integrity and AI/provider activity with each owner.
6. Record scope, recovery, and required code changes in the private incident log
   and update `docs/STATUS.md` without sensitive values.

## Backup, restore, and rollback

Arcade has no repository-owned durable server data. The manifest cache is lost
on restart; local/session storage is per browser and disposable. Back up the
private continuity register and hosting configuration through approved secure
systems. Upstream owners are responsible for business-data backups.

To recover, obtain repository and Render access, restore environment metadata
from the private register, deploy a reviewed known-good commit, verify health and
discovery, then verify each upstream read path. To roll back, redeploy the last
known-good commit in Render and ensure the static web artifact's compiled BFF URL
matches the intended BFF. Do not roll back an upstream contract independently
without checking compatibility.

No backup, restore, or rollback was executed during the documentation audit.

