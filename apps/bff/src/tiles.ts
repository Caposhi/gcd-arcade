/**
 * Turns backend manifests into the hub's ordered tile list, per the master
 * prompt's recommended XMB layout:
 *
 *   1. Agents Live View   (gcd-social)
 *   2. Attribution        (attribution)
 *   3. Call Transcripts   (gcd-webhook program "transcripts")  — top level
 *   4. SMS Inbox          (gcd-webhook program "sms-inbox")     — top level
 *   5. Automation Server  (gcd-webhook, remaining programs as sub-views)
 *
 * Static fallbacks let the ribbon render even when an app is offline: we know
 * each tile's identity from the spec, so a down app degrades to an "OFFLINE"
 * tile instead of disappearing or crashing the shell.
 */
import type { ConsoleManifest, ConsoleProgram, Tile, ViewKind, ConsoleTheme } from "@gcd-arcade/shared";
import { REGISTRY, type AppEntry } from "./registry.js";

const GCD_BRAND: ConsoleTheme = { palette: ["#182848", "#18479F", "#F8E000"], style: "GCD brand", icon: "🎮" };

/** Static identity used when an app's manifest can't be fetched. */
const FALLBACK_MANIFEST: Record<string, ConsoleManifest> = {
  "gcd-social": {
    id: "gcd-social",
    name: "Agents Live View",
    tagline: "Autonomous social posting — Instagram + Facebook",
    theme: { palette: ["#182848", "#18479F", "#F8E000"], style: "8-bit shop floor", icon: "🔧" },
  },
  attribution: {
    id: "attribution",
    name: "Attribution Dashboard",
    tagline: "Meta Ads ↔ Tekmetric offline revenue attribution",
    theme: { palette: ["#0b1f3a", "#1877F2", "#42b72a"], style: "neon trading terminal", icon: "📊" },
  },
  "gcd-webhook": {
    id: "gcd-webhook",
    name: "GCD Automation",
    tagline: "Webhooks, validation, compliance, win-back, transcripts & SMS",
    theme: { palette: ["#1a1a2e", "#e94560", "#0f3460"], style: "control-room terminal", icon: "🛠️" },
    programs: [
      { id: "transcripts", name: "Call Transcripts", icon: "📞", externalUrl: "/api/admin/transcripts" },
      { id: "sms-inbox", name: "SMS Inbox", icon: "💬", externalUrl: "/admin/sms" },
      { id: "winback", name: "Declined-Job Win-Back", icon: "🎯" },
      { id: "maintenance", name: "DetectAuto Maintenance", icon: "🔧" },
      { id: "validation", name: "Customer Validation", icon: "✅" },
      { id: "inspections", name: "DVI Compliance", icon: "🔎" },
      { id: "email-audit", name: "Monthly Email Audit", icon: "📧" },
      { id: "next-service", name: "Next-Service Scheduler", icon: "🗓️" },
      { id: "engagement", name: "Engagement Tracking", icon: "📈" },
      { id: "marketing-bonus", name: "Marketing Bonus", icon: "💰" },
    ],
  },
};

/** gcd-webhook programs that get their own top-level tile (with their view). */
const WEBHOOK_TOP_LEVEL: Record<string, ViewKind> = {
  transcripts: "transcripts",
  "sms-inbox": "sms-inbox",
};

export interface FetchedManifest {
  entry: AppEntry;
  manifest: ConsoleManifest | null; // null → fetch failed (offline)
}

function manifestFor(entry: AppEntry, fetched: ConsoleManifest | null): { m: ConsoleManifest; online: boolean } {
  if (fetched) return { m: fetched, online: true };
  return { m: FALLBACK_MANIFEST[entry.id] ?? { id: entry.id, name: entry.id }, online: false };
}

/** Build the link-out URL for a program/app, resolving relative externalUrls
 *  against the backend base and attaching admin secret if configured. */
function resolveExternalUrl(entry: AppEntry, raw?: string | null): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, entry.baseUrl);
  } catch {
    return raw; // not absolute and no base; hand back as-is
  }
  if (entry.adminSecret && /\/(admin|api\/admin)\//.test(url.pathname)) {
    url.searchParams.set("secret", entry.adminSecret);
  }
  return url.toString();
}

function buildSocialTile(entry: AppEntry, fetched: ConsoleManifest | null): Tile {
  const { m, online } = manifestFor(entry, fetched);
  const theme = m.theme ?? FALLBACK_MANIFEST["gcd-social"].theme;
  return {
    id: entry.id,
    appId: entry.id,
    name: m.name,
    tagline: m.tagline,
    description: m.description,
    icon: theme?.icon ?? "🔧",
    theme,
    view: "agents",
    externalUrl: resolveExternalUrl(entry, m.externalUrl),
    enabled: entry.enabled,
    online,
  };
}

function buildAttributionTile(entry: AppEntry, fetched: ConsoleManifest | null): Tile {
  const { m, online } = manifestFor(entry, fetched);
  const theme = m.theme ?? FALLBACK_MANIFEST["attribution"].theme;
  return {
    id: entry.id,
    appId: entry.id,
    name: m.name,
    tagline: m.tagline,
    description: m.description,
    icon: theme?.icon ?? "📊",
    theme,
    view: "attribution",
    externalUrl: resolveExternalUrl(entry, m.externalUrl),
    enabled: entry.enabled,
    online,
  };
}

function buildWebhookTiles(entry: AppEntry, fetched: ConsoleManifest | null): Tile[] {
  const { m, online } = manifestFor(entry, fetched);
  const programs: ConsoleProgram[] = m.programs ?? FALLBACK_MANIFEST["gcd-webhook"].programs ?? [];
  const tiles: Tile[] = [];

  const subViews: Tile[] = [];
  for (const p of programs) {
    const view = WEBHOOK_TOP_LEVEL[p.id];
    const tile: Tile = {
      id: `${entry.id}:${p.id}`,
      appId: entry.id,
      program: p.id,
      name: p.name,
      icon: p.icon ?? "🕹️",
      theme: m.theme,
      view: view ?? "live",
      externalUrl: resolveExternalUrl(entry, p.externalUrl),
      enabled: entry.enabled,
      online,
    };
    if (view) {
      tiles.push(tile);
    } else {
      subViews.push(tile);
    }
  }

  // The grouping "Automation Server" tile that opens to the remaining programs.
  tiles.push({
    id: `${entry.id}:automation`,
    appId: entry.id,
    name: "Automation Server",
    tagline: m.tagline,
    description: m.description,
    icon: m.theme?.icon ?? "🛠️",
    theme: m.theme,
    view: "automation",
    externalUrl: null,
    enabled: entry.enabled,
    online,
    children: subViews,
  });

  return tiles;
}

/** Assemble the full ordered tile list from fetched manifests. */
export function buildTiles(fetched: Record<string, ConsoleManifest | null>): Tile[] {
  const tiles: Tile[] = [];
  for (const entry of REGISTRY) {
    const m = fetched[entry.id] ?? null;
    if (entry.id === "gcd-social") tiles.push(buildSocialTile(entry, m));
    else if (entry.id === "attribution") tiles.push(buildAttributionTile(entry, m));
    else if (entry.id === "gcd-webhook") tiles.push(...buildWebhookTiles(entry, m));
  }
  return tiles;
}

export { GCD_BRAND };
