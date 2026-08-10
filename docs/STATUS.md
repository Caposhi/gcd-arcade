# Current status

**As of:** 2026-08-10

**Evidence:** local `main` at `b52144b`; clean before this documentation work.

## Verified in the repository

- Active root npm-workspaces monorepo with React/Vite web, Express BFF, and
  shared TypeScript package.
- Four registry entries and the BFF route/credential behavior documented in the
  current runbooks.
- No database, migrations, queue, cron scheduler, tests, lint script, CI
  workflow, Dockerfile, or second application tree.
- Render blueprint defines one Node service and one static service.
- The web includes specialized GCD Social, Attribution, transcripts, win-back,
  and four QBO module views; some fallbacks and comments retain older product
  terminology but active presentation is the light launcher redesign.
- `integrations/` files are not part of any workspace build.

## Open risks

| Priority | Risk / uncertainty | Needed decision or evidence |
|---|---|---|
| Critical | No BFF authentication/authorization; CORS is open | choose and implement identity, roles, origin policy, and hosting restriction |
| Critical | Unauthenticated refresh and AI POSTs can cause external work, cost, or persistence | gate by role; add validation, limits, audit trail, and abuse controls |
| High | Admin secret enters browser-visible redirect URL | replace with authenticated server proxy or upstream session flow; rotate if exposure is suspected |
| High | Sensitive transcript/customer/financial data may be reachable by URL | verify Render exposure immediately and restrict access |
| High | Live Render services, env, owners, monitoring, backups, and rollback rights unverified | inspect private operational systems and fill continuity register |
| Medium | No automated tests or CI | add route/allowlist/auth tests, frontend tests, and build/audit/secret-scan CI |
| Medium | Integration reference snapshots can drift from upstream repositories | compare contracts and archive or regenerate copies with provenance |
| Medium | Query-string console tokens may reach upstream logs | migrate to header-only after compatibility review |
| Medium | No rate limits, audit logs, structured monitoring, or readiness check | define operational controls and alerts |
| Medium | Main web bundle exceeds Vite's 500 KB chunk warning threshold | evaluate route/view code splitting and a performance budget |

## Validation record

- `npm ci`: passed on Node `v24.11.1` / npm `11.6.2`; 227 packages installed
  from the lockfile.
- `npm run build`: passed for shared, BFF, and web. Vite warned that the main
  minified JavaScript chunk is about 650 KB (189 KB gzip), above its 500 KB
  warning threshold.
- `npm audit`: failed with 7 advisories (5 high, 1 moderate, 1 low). The one
  production advisory is low-severity `body-parser`; `nanoid`, `postcss`,
  `shell-quote`, and the Vite/`esbuild` chain account for development/build
  findings. No automatic or breaking upgrade was applied.
- Markdown relative links: passed for all 17 Markdown files.
- Active environment coverage: passed; 18 active variables, 18 example
  variables, no missing or obsolete entries.
- Credential/PII pattern review: common private-key and provider-token markers
  were absent from the current tree and scanned Git history; likely PII terms
  are data-field names and documentation warnings rather than embedded records.
- `git diff --check`: passed after removing one trailing blank line.
- Complete diff and full modified-document review: passed.

## Externally unverified

No live endpoint, Render dashboard, upstream repository, provider account,
credential pairing, deployment, backup, restore, or rollback was exercised.
Historical integration docs contain deployment claims that are not accepted as
current evidence.

## Next milestone

First restrict BFF/hosting access and design Arcade-side authentication and
authorization, including explicit protection for POST and sensitive transcript/
financial routes. In parallel, verify Render ownership/configuration and create
the private continuity register. Then add automated route/security tests and CI.
