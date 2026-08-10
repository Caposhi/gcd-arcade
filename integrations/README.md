# Backend console reference material

> **Reference/adaptation material—not deployed Arcade code.** These snapshots
> were not compared with the current upstream repositories during the 2026-08-10
> audit. Upstream source wins. Current Arcade-side boundaries are documented in
> [`../docs/INTEGRATIONS.md`](../docs/INTEGRATIONS.md).

Arcade expects enabled upstreams to expose a small console contract:

- `GET /console/manifest` for identity, theme, programs, and link-outs;
- `GET /console/state` for a compact, app-specific snapshot; and
- `GET /console/stream` for SSE events, optional `since` replay, heartbeats,
  and optional `program` filtering.

The files here are point-in-time implementation aids for repositories outside
this monorepo:

| Path | Intended external target | Status in this repository |
|---|---|---|
| `attribution/console.ts` | Attribution Fastify API | uncompiled reference snapshot |
| `attribution/MILESTONES.md` | Attribution job instrumentation | unverified wiring plan |
| `gcd-webhook/console.js` | gcd-webhook Express service | uncompiled reference snapshot |
| `gcd-webhook/MILESTONES.md` | gcd-webhook event instrumentation | unverified wiring plan |
| `gcd-qbo-hub/console.reference.ts` | QBO Hub route handlers | uncompiled mirror; upstream wins |
| `gcd-qbo-hub/README.md` | QBO Hub contract notes | unverified external-repo snapshot |

## Safe adoption protocol

1. Open the current upstream repository in an isolated workspace and read its
   instructions, source, tests, schemas, and deployment configuration.
2. Compare the reference with the real framework, routes, payloads, data model,
   queue names, retention rules, and authentication. Do not paste blindly.
3. Keep telemetry observational and fail-soft. It must not change business
   outcomes or throw into production paths.
4. Require authentication appropriate to the sensitivity of the payload.
   Prefer a header to query-string credentials, and never expose secret values
   to browser code, docs, logs, examples, or commits.
5. Coordinate a backward-compatible contract and deployment/rollback order with
   Arcade. Update both repositories' current documentation in the same change.
6. Validate in the upstream repository and a non-production environment before
   enabling Arcade. Do not use live customer, transcript, or financial data as
   fixtures.

## Contract verification

Use a confirmed non-production base URL and approved test credential. The
fictional commands below must be adapted privately:

```bash
curl --fail --silent https://service.example.invalid/console/manifest
curl --fail --silent https://service.example.invalid/console/state
curl --no-buffer https://service.example.invalid/console/stream
```

Verify response schemas, unauthorized behavior, CORS/origin policy, SSE replay
and disconnect cleanup, payload redaction, event retention, timeout/failure
behavior, and Arcade's offline degradation. A successful request proves only
that one endpoint answered; it does not prove complete wiring or production
deployment.
