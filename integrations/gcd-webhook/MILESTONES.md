# gcd-webhook — live-event milestone wiring

These are the `pushConsole(...)` calls that make each program's **live stream**
light up in the hub (the left-panel counts already work via `/console/state`;
this is what fills the "LIVE STREAM" / Automation tiles with activity).

- Prereq: `console.js` is installed and `mountConsole(app, …)` is wired (done).
- Import once near the top of `server.js` (alongside the existing require):
  ```js
  const { pushConsole, mountConsole } = require("./console");
  ```
- Every call is **fire-and-forget** — safe in hot paths; wrap nothing, it never
  throws into your logic. Adapt the variable names in `{…}` to what's in scope.
- Signature: `pushConsole(program, kind, message, data)`. `program` routes the
  event to the right hub view; `kind` + `message` show on the stream.

Status: **`sms-inbox` is already wired** (in `saveSMSMessage`). The rest below
are the remaining one-liners — drop each at the noted spot.

---

### validation — `runValidationsAndUpdateCustomer()`
After the ZeroBounce check, and after the USPS check:
```js
pushConsole("validation", "zerobounce", `ZeroBounce: ${zbResult}`, { email });
pushConsole("validation", "usps", `USPS: ${uspsOk ? "valid" : "bad"}`, { address });
```

### inspections — `handleCompletedRepairOrder()`
After determining whether the completed RO has a DVI:
```js
pushConsole("inspections", hasDVI ? "ok" : "missing", `RO #${roNumber}`, { repairOrderId, hasDVI });
```

### winback — `processDailyReminders()`
Inside the per-job loop when a reminder is sent, then a summary at the end:
```js
pushConsole("winback", "sms", `reminder → ${name}`, { jobId, tier });
// after the loop:
pushConsole("winback", "batch", `${sentCount} reminders sent`, { sent: sentCount });
```

### maintenance — `processMaintenanceReminders()`
When a stage reminder fires:
```js
pushConsole("maintenance", `stage:${stage.key}`, `${name} · ${stage.label}`, { reminderId });
```

### next-service — `processNextServiceAppointments()`
After dropping a tentative appointment:
```js
pushConsole("next-service", "created", `${rule.service} · ${dueDate}`, { ro });
```

### email-audit — `runMonthlyEmailAudit()`
After the audit completes:
```js
pushConsole("email-audit", "removed", `${removed} undeliverable removed`, { checked, removed });
```

### engagement — `POST /webhooks/sendgrid-events` handler
Inside the loop over `req.body` events:
```js
pushConsole("engagement", ev.event, ev.email, { url: ev.url }); // ev.event = "open" | "click"
```

### transcripts — `runNightlySync()`
After the nightly sync finishes:
```js
pushConsole("transcripts", "sync", `synced ${count} calls`, { count });
```

### marketing-bonus — `scripts/marketing-bonus` (monthly cron)
After the sheet update:
```js
pushConsole("marketing-bonus", "update", `${rows} rows updated`, { rows });
```

### sms-inbox — already wired (reference)
```js
pushConsole("sms-inbox", message.dir, message.text.slice(0, 40), { phone: message.phone });
```

---

After deploying, verify the stream carries them:
```bash
curl -N "https://gcd-webhook.onrender.com/console/stream?program=winback"
# then trigger the program (or wait for its cron) — frames should print.
```
