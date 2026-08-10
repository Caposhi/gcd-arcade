# HISTORICAL ONLY — NOT OPERATIONAL

This completed implementation brief is preserved for design history. It contains
superseded file names, instructions, and open items. Use current source and the
root documentation set for all work.

# GCD Arcade — Redesign Handoff for Claude Code

Source repo: `Caposhi/gcd-arcade` (branch `main`). This is a **visual + IA redesign only** — no BFF/contract/business-logic changes. Reference mockup for the new look: `GCD Arcade Redesign.dc.html` in this project (open in a browser; 7 screens, switchable via the dashed navy bar at the top — that bar is a review aid only, do not ship it).

## Direction
Replace the PS3/PSP "XMB" retro-arcade skin (glossy tiles, CRT scanlines, boot animation, sound effects, "INSERT COIN") with a clean, light, Apple-style launcher on GCD's real brand colors — closer to macOS Launchpad / iOS home screen than a game console. Audience is 1-2 technical operators, so the UI can be quiet and information-dense inside each app, minimal on the home screen.

## What's dropped entirely
- CRT scanline overlay (`shell/Crt.tsx`) — delete file, remove from `App.tsx`.
- Boot intro animation, "press any key to skip" — replace with a real loading state (see below).
- All sound effects / ambient music (`lib/sound.ts` and every `sfx.*()` call in `Xmb.tsx`, `ViewHost.tsx`, `Automation.tsx`, `Settings.tsx`) — remove the calls; delete `sound.ts` if nothing else references it.
- TV Mode.
- "INSERT COIN" / arcade copy — replace with plain "Coming soon".
- Horizontal ribbon carousel nav — replaced by a static grid (see Home below).

## Design tokens
Add this token block to the top of `theme/arcade.css` (replacing the current dark `:root`), and rewrite every rule below it against these instead of the old `--bg-0/--bg-1/--ink` dark palette:

```css
:root {
  --royal-blue: #18479F;
  --royal-blue-600: #143C87;
  --lemondrop: #F8E000;
  --navy-blue: #182848;
  --powder-blue-100: #EEF4FC;
  --white: #FFFFFF;
  --gray-50: #F6F8FB;
  --gray-100: #ECF0F6;
  --gray-200: #DCE3EC;
  --gray-300: #C3CDDB;
  --gray-400: #97A4B7;
  --gray-500: #6B7889;
  --gray-800: #212933;
  --success: #1E8E4E;
  --danger: #C81E1E;

  --bg-page: var(--white);
  --bg-muted: var(--powder-blue-100);
  --text-strong: var(--navy-blue);
  --text-body: var(--gray-800);
  --text-muted: var(--gray-500);
  --border-subtle: var(--gray-200);
  --border-brand: var(--royal-blue);

  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-pill: 999px;

  --shadow-sm: 0 1px 3px rgba(24,40,72,.10), 0 1px 2px rgba(24,40,72,.06);
  --shadow-xl: 0 24px 48px rgba(24,40,72,.18);
  --ease-standard: cubic-bezier(.2,0,.2,1);
  --dur-fast: 120ms;
  --dur-base: 200ms;

  --font-heading: -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
  --font-body: -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
}
```

These are the real GCD brand values (from the bound design system), trimmed to what the arcade needs. If you want the exact Eurostile display face for the wordmark later, pull `assets/fonts/*.otf` + `tokens/fonts.css` from the GCD design system project — not required for this pass; the system-font stack above reads clean and Apple-like on its own.

## Icons
Currently each tile's icon is a raw emoji from `tile.icon` (backend-supplied). Replace with **Lucide** (`npm install lucide-react`) rendered client-side from a small id→icon lookup, since a hardcoded, curated icon per known app reads far more intentional than trusting arbitrary backend emoji:

```ts
const APP_ICON: Record<string, string> = {
  "gcd-social": "sparkles",
  "german-car-depot-attribution": "trending-up",
  "gcd-webhook": "workflow", // Automation Server
  "gcd-webhook:call-transcripts": "phone-call",
  "gcd-webhook:sms-inbox": "message-square",
};
const DEFAULT_ICON = "layout-grid";
```

Fall back to `DEFAULT_ICON` for anything unmapped (new backends, automation sub-programs) — don't block shipping on covering every id.

## Screen-by-screen

### 1. Home launcher (`shell/Xmb.tsx` → rename to `Launcher.tsx`)
Static CSS grid of app icon tiles (see mockup "Home"), not a scrolling ribbon:
- 88×88px rounded-square tile, `--bg-muted` fill, Lucide icon centered (34px, `--royal-blue`).
- One small 11px status dot top-right of the tile: green (`--success`) online, gray (`--gray-400`) offline/disabled. No text badges ("3 pending", "ROAS 3.4×", "INSERT COIN") on the home screen — that detail moves inside each app (see below).
- Name label below, centered, 14px demi, `--text-strong`.
- Click/Enter opens the tile. Arrow-key grid navigation (↑↓←→) is fine to keep for keyboard users but drop the "active tile enlarges + ribbon re-centers" animation — it's a game-console affordance, not needed for a static grid.
- Top bar: small "GCD Arcade" wordmark left, clock + a single settings icon button right. Drop the `⚙️` emoji button — use a Lucide `settings` icon in a circular ghost button.
- Delete the "selinfo" hover panel (tagline + recent-activity preview) under the ribbon — with a static grid there's no "selected" tile to describe; that content already exists once you open the app.

Keep the existing `fetchApps()` / `fetchState()` data loading as-is — this is a presentational rewrite of `Xmb.tsx`, not a data-layer change. `badges.ts`'s `summarizeBadge()` is still useful — just render its output *inside* the opened app (snapshot panel / header caption), not as a pill floating on the home tile.

### 2. Loading state (replaces `shell/Boot.tsx`)
Drop the multi-second animated intro entirely. Show a plain centered wordmark + a thin indeterminate progress bar (see mockup "Boot") only while the real `fetchApps()` call is in flight on first load — i.e. tie it to actual data readiness, not a timer. No "press any key to skip" (there's nothing to skip).

### 3. Opened-app header (`views/ViewHost.tsx`)
Keep the structure (back button, icon, name, tagline, spacer, external link button, settings, back) but restyle to light chrome: white background, `--border-subtle` bottom hairline, back button as a circular ghost icon button (Lucide `chevron-left`), external-link button as a royal-outline button (not a solid pill), remove all `sfx.*()` calls.

**Do not drop the "Open full app" link-out.** `tile.externalUrl` is how a user jumps from the arcade's summary view to the real, full dashboard for that backend (GCD-SOCIAL's own UI, the Attribution app, etc.) — the arcade only ever shows a lightweight snapshot + live feed, never the full feature set. Every opened app that has an `externalUrl` (already the existing `{tile.externalUrl && <a className="btn linkout" ...>}` condition in `ViewHost.tsx`) must keep showing this button in its header, restyled per the mockup (secondary/royal-outline `Button`, "Open full app ↗"), on every screen — Live view, Automation, GCD Social, and Attribution alike, not just one of them.

### 4. Generic live view (`views/LiveView.tsx`)
No logic changes — same `fetchState` + `useStream` wiring. Restyle only: white cards, `--border-subtle` 1px borders, `--shadow-sm`, KPI rows as label/value pairs with a hairline divider (see mockup "Call Transcripts"), event rows as icon-chip + message + right-aligned timestamp (drop the terminal/monospace green-on-black event log look).

### 5. Automation drill-down (`views/Automation.tsx`)
Same logic (children grid → click → program-filtered `LiveView`). Restyle sub-cards to match the mockup: icon tile + name + a small pill badge (still fine to show live counts here, e.g. "4 active" — this is one level in, not the home screen).

### 6. Settings (`shell/Settings.tsx` + `lib/settings.tsx`)
Replace the toggle list. New `Settings` shape:
```ts
export interface Settings {
  appearance: "light" | "dark" | "auto";
  liveBadges: boolean;   // show/hide the home-screen status dots
  reducedMotion: boolean;
}
```
Drop `sound`, `music`, `crt`, `tvMode`. UI: a 3-way segmented control for Appearance, two toggle rows, and a version/about line at the bottom (see mockup "Settings"). If dark mode isn't being built this pass, still ship the control wired to a no-op / "Auto" default so it's not a dead promise — or omit the option and say so; your call, flag it either way in the PR description.

### 7. Placeholder (`views/Placeholder.tsx`)
Keep logic, change copy: "Coming soon" instead of "insert coin", same centered icon + name layout, restyled to light chrome.

### 8. GCD Social world (`views/agents/*`)
Keep `engine.ts` — it already derives agent status, brief pipeline, and moments from the live SSE feed (`agent:start/done`, `brief:published`, `critic:verdict`, `brief:escalated`) defensively against the payload shape. Replace only the *presentation* layer:
- `Office.tsx` (desks/sprites) → a plain "Team" list: one row per agent (icon tile + name + role + current status text from the engine's per-agent state), matching mockup "GCD Social".
- `Hud.tsx` (Level/XP/Reputation/Buzz tycoon meter) → a row of 4 plain stat cards. Map what's real: "Posts this week" and "Streak" likely come straight from `save.ts`'s cumulative counters; "Approval rate" should be computed from the engine's tracked `critic:verdict PASS/FAIL` counts (check `engine.ts` for the exact field before hardcoding); if there's no live "Engagement" number in the feed yet, don't invent one — omit that card or label it clearly as a placeholder pending a real metric from GCD-SOCIAL.
- `Moments.tsx` (confetti/cha-ching/klaxon flourishes) → a plain "Recent activity" list, icon + message + timestamp, no animation stingers.
- You can keep `save.ts`'s localStorage persistence for whatever counters survive into the plain stat cards; drop anything that's purely game-y (XP curve, "reputation" as an arbitrary score) unless it maps to something a real ops user cares about.

### 9. Attribution world (`views/attribution/*`)
Keep `engine.ts` and `format.ts` (BullMQ job derivation, $ / RO-number formatting) — restyle only:
- `Board.tsx` (ticker tape/hero) → 4 plain stat cards: Ad spend, Revenue, ROAS (royal-blue, largest), CAC.
- `Lanes.tsx` (neon execution lanes) → a plain job list: name, status label, thin progress bar (see mockup "Attribution" jobs panel). Status colors: completed=`--success`, running=`--royal-blue`, queued=`--gray-400`, failed=`--danger`.
- `Tape.tsx` (live match prints) → a plain "Recent matches" list: amount (bold, `--success`), description, timestamp.
- `Funnel.tsx` → horizontal bar rows, one per stage, width proportional to the largest stage's value (see mockup).
- `Moments.tsx` (ka-ching/klaxon/high-score flourishes) → drop the game flourishes; a failed job can still get a plain `--danger`-colored row, that's enough signal.

## Not in scope / no changes needed
- `apps/bff/*`, `packages/shared/*`, the `/console/*` contract — untouched.
- `lib/sse.ts`, `lib/bff.ts` — untouched (pure data layer).
- `Clock.tsx` — keep logic, just inherits the new light text colors.

## Open items to confirm against the live GCD-SOCIAL / Attribution feeds before shipping
- Exact field(s) for "approval rate" and any real engagement metric in the Agents dashboard — the mockup's numbers are illustrative.
- Whether Automation's sub-programs (currently unnamed generic `programs[]` from `gcd-webhook`) should get individual icon mappings once that backend's manifest is finalized, or keep falling back to a generic icon.
