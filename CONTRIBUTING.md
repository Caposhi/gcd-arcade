# Contributing

## Workflow

1. Read `AGENTS.md`, `README.md`, and the runbooks relevant to the change.
2. Inspect Git status and history; preserve unrelated work.
3. Identify the active component and its upstream/downstream contract before
   editing. Changes under `integrations/` do not alter deployed upstream apps.
4. Use `.env.example` with integrations disabled. Never use live credentials or
   production customer/financial data for local validation.
5. Make the smallest coherent change, including documentation in the same diff.
6. Validate, reread every changed document, and review the complete diff.
7. Record external prerequisites, failed checks, and operational follow-ups.

## Common commands

```bash
npm ci
npm run dev
npm run build
npm audit
git diff --check
git status --short --branch
```

There is no checked-in test suite, lint script, CI workflow, migration command,
or Docker workflow. Adding one requires documenting it here and in the relevant
runbooks.

## Definition of done

- The production build and any newly applicable tests/type checks pass.
- No secret, token, private key, PII, transcript, customer export, or financial
  export was added.
- Active environment reads and `.env.example` agree, including safe defaults.
- Changed routes, payloads, storage, timeouts, cache behavior, and trust
  boundaries are reflected in `README.md` and `docs/`.
- All relative Markdown links resolve and `git diff --check` passes.
- Every modified document has been reread in full.
- Deployment and live integration claims are backed by direct evidence; unknowns
  are explicit.
- The entire diff is reviewed, with no unrelated user changes overwritten.

