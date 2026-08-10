# Repository rules

These rules apply to humans, Codex, all other AI agents, automated refactors,
dependency updates, generated code, and emergency work.

## Safety and scope

- Read this file and inspect `git status --short --branch` before changing files.
- Preserve existing work. Do not reset, discard, commit, push, deploy, change
  external systems, rotate credentials, rewrite history, or delete data without
  explicit authorization.
- Treat `apps/` and `packages/` as active. Treat `integrations/` as reference
  material for other repositories and `docs/archive/` as non-operational history.
- Never put secrets, production personal data, transcript content, customer
  records, financial exports, or live credential-bearing URLs in the repository.
- Do not run migrations, seed data, invoke production write routes, or test AI
  endpoints against live services without an identified target and approval.
- Do not claim deployment, restoration, or integration success without direct
  validation; record external uncertainty instead.

## Mandatory continuous-documentation rule

Documentation is part of every change. A repository change is not complete until
the author has:

1. identified every Markdown file, environment example, runbook, diagram,
   command, path, inline operational note, and external setup description
   affected by the change;
2. updated those references in the same atomic change as the code,
   configuration, infrastructure, schema, integration, or process change;
3. removed or explicitly archived instructions that no longer apply;
4. reread every modified document as a whole and confirmed unchanged sections
   remain correct for the current edition;
5. verified documented paths, commands, variables, ports, service names,
   routes, schedules, links, and identifiers against source;
6. updated the root handoff README whenever architecture, data flow, deployment,
   security, operations, ownership, recovery, or external dependencies change;
7. recorded unresolved uncertainty, manual prerequisites, rollout gates, and
   external-system dependencies instead of presenting them as completed.

This rule applies to humans, Codex, all other AI agents, automated refactors,
dependency updates, generated code, and emergency work. Documentation-only
follow-up is not an acceptable substitute except for a genuine emergency
hotfix; any exception must be recorded as a blocking follow-up before closure.

## Required validation

Run checks proportional to the change. At minimum for active code or config:

```bash
npm ci
npm run build
npm audit
git diff --check
```

Also verify Markdown relative links, active-code environment coverage, and
credential/PII patterns; review the complete diff. This repository currently
has no test or lint script, so never report either as passing. If a check cannot
run because of network, credentials, permissions, or services, record exactly
what was not verified in `docs/STATUS.md` and the final handoff.

