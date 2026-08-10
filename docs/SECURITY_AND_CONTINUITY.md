# Security and continuity

## Current security posture

The BFF is a credential-bearing privilege concentrator. It disables the Express
signature but otherwise uses open CORS and has no authentication, session,
authorization, rate limiting, CSRF protection, origin allowlist, audit log, or
route-specific role checks. Possession of the URL is the current access model;
that is not a sufficient control for transcript, customer, financial, or AI
capabilities.

Highest-priority findings:

1. Every BFF GET and POST route is reachable without Arcade-side identity.
2. QBO refresh can cause a live external fetch; QBO assistant messages can be
   persisted and billed; transcript AI chat can be billed and process sensitive
   data. These must not rely solely on URL secrecy.
3. The admin link-out adds `GCD_WEBHOOK_ADMIN_SECRET` to a 302 destination. It
   is absent from page source but visible to the browser and may enter history,
   destination logs, screenshots, and referrers.
4. Console tokens are also added to upstream query strings as well as headers,
   increasing log exposure. Prefer headers once upstream compatibility permits.
5. Proxy responses and errors are forwarded with limited filtering; upstreams
   must not return secrets or excessive sensitive content.

## Secrets and sensitive data

Store secrets only in approved hosting/secret managers. Documentation and the
private continuity register record the secret's purpose, storage location,
owner, rotation procedure, and last review—never its value. Separate console
tokens per upstream and environment. Do not reuse admin or bridge credentials.

Potential sensitive data includes customer phone/name and call transcript
content; complaints, pricing and follow-up context; win-back and service data;
ad spend/revenue; QBO reports, cash-sheet exceptions and payees; coworker
questions; social content; and AI conversation history. Avoid console logging,
fixtures, screenshots, browser exports, and issue attachments containing it.
Browser data is origin-scoped but not encrypted by the app.

The current-tree and Git-history pattern scan performed on 2026-08-10 found no
private-key markers or common provider token prefixes. Pattern scans are not
proof that no credential or PII exists. If a real credential is found, do not
echo it: restrict access, rotate provider-side, assess history/log exposure, and
treat history cleanup as a separate coordinated decision.

## Private continuity register

Maintain outside Git:

- repository, GitHub organization, Render account/service, and domain owners;
- service URLs and environment names;
- secret-manager locations and rotation owners for each token/secret;
- upstream repository and deployment contacts;
- AI/QBO/provider account and billing owners;
- hosting privacy/firewall configuration and emergency shutoff procedure;
- monitoring/log locations and retention;
- backup/restore evidence and last recovery exercise;
- approved operator roster and access-review dates.

## Takeover and access review

For takeover, obtain least-privilege repository and hosting access, inventory
live services without changing them, compare variable names (not values) with
`docs/ENVIRONMENT.md`, verify route exposure, confirm upstream owners, and test
health/read paths using non-sensitive data. Do not invoke POST bridges merely as
health checks.

Review access at least quarterly and after personnel/provider changes. Remove
stale access, rotate shared credentials, verify hosting restrictions and allowed
origins, review AI/provider usage, and record evidence privately. Code changes
to authentication or credential transport must update architecture, operations,
environment, integration, and status documents atomically.

