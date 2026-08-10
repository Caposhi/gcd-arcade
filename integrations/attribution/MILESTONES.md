# Attribution — tape milestone wiring

> **External-repository reference only.** This point-in-time wiring plan is not
> proof that the calls exist or are deployed. Verify the current Attribution
> source and operational owner before applying it.

The job **lanes** already animate from BullMQ `QueueEvents` (done). These two
calls make the hub's **tape** print and its moments fire: a green "MATCH
PRINTED · +$amount" when revenue is attributed, and an "ORDERS AWAY" when a
CAPI batch is sent.

- Prereq: `apps/api/src/routes/console.ts` exposes `consoleEmit(kind, message, data)`
  and is registered at root (`/console/*`) — done.
- Import where your attribution + CAPI jobs run:
  ```ts
  import { consoleEmit } from "../routes/console"; // adjust path
  ```
- Fire-and-forget; never let it affect the job. Field names below map exactly to
  what the hub's terminal reads — keep `amount`, `roId`, `campaign`, `count`,
  `accepted`.

---

### match — where a lead is matched to an RO and revenue is attributed
In the attribution job, right after you attribute revenue to a repair order
(inside the loop, one call per attributed conversion):
```ts
consoleEmit("match", `RO #${roId}`, { amount: revenue, roId, campaign: campaignName });
```
- `amount` (number) → printed as `+$…` and drives the ka-ching moment.
- `roId` / `campaign` (strings) → shown on the tape row. Omit if unavailable;
  the row still prints.

### capi — where offline conversions are sent to Meta
In the CAPI send job, after a batch is POSTed to the Conversions API:
```ts
consoleEmit("capi", `${sent} conversions sent`, { count: sent, accepted: res.ok });
```
- `count` (number) → "CAPI ▸ N sent".
- `accepted` (bool) → ✓/✗ on the row; triggers the "ORDERS AWAY" sweep.

(Optional) on a rejected/failed CAPI batch you can emit the same with
`accepted: false` so the tape shows the rejection.

---

### Notes
- The lane labels in the hub derive from the BullMQ job **names** the feed
  reports. Current real names map correctly (`sync-meta-daily-stats` → ingest,
  `lead-ro-match` → match, `compute-attribution` → attribute,
  `capi-conversions` → CAPI, `compute-data-quality` → data-quality). If you add
  jobs whose names don't contain those keywords, tell me and I'll extend the
  matcher in `apps/web/src/views/attribution/engine.ts` (`laneKeyFor`).
- ROAS reads `$0` because the attributed-revenue query currently sums to 0
  (1 attributed conversion, no revenue). If revenue *should* be present, check
  the `AttributedConversion` revenue column in `/console/state` — the hub just
  displays whatever the feed returns.

Verify after deploy:
```bash
curl -N "https://gcd-attribution-api.onrender.com/console/stream"
# trigger an attribution run — "match"/"capi" frames should print.
```
