/**
 * The app registry — the only place that knows each backend's base URL and
 * (optionally) its server-side console token. Everything is env-driven so the
 * same code runs in dev and on Render without edits.
 *
 * Tokens NEVER reach the browser. The BFF attaches them when calling upstream.
 */

export interface AppEntry {
  id: string;
  baseUrl?: string;
  /** Optional per-app CONSOLE_TOKEN; sent upstream as ?key= and x-console-token. */
  consoleToken?: string;
  /**
   * Optional admin secret for backends whose existing UIs are guarded by
   * `?secret=` (gcd-webhook's /admin/sms and /api/admin/transcripts). Only used
   * to build link-out URLs server-side; never echoed in /api/apps payloads.
   */
  adminSecret?: string;
  /**
   * Optional bearer secret for backends gated by `Authorization: Bearer` on
   * specific bridge routes (gcd-qbo-hub's /api/external/*), as opposed to
   * `adminSecret`'s `?secret=` convention. Only used server-side; never
   * echoed in /api/apps payloads.
   */
  bearerSecret?: string;
  enabled: boolean;
}

/** Default base URLs documented in the master prompt; overridable via env. */
const DEFAULT_GCD_SOCIAL_URL = "https://gcd-social-api.onrender.com";

export const REGISTRY: AppEntry[] = [
  {
    id: "gcd-social",
    baseUrl: process.env.GCD_SOCIAL_URL || DEFAULT_GCD_SOCIAL_URL,
    consoleToken: process.env.GCD_SOCIAL_CONSOLE_TOKEN,
    enabled: envFlag(process.env.GCD_SOCIAL_ENABLED, true),
  },
  {
    id: "attribution",
    baseUrl: process.env.ATTRIBUTION_URL,
    consoleToken: process.env.ATTRIBUTION_CONSOLE_TOKEN,
    enabled: envFlag(process.env.ATTRIBUTION_ENABLED, true),
  },
  {
    id: "gcd-webhook",
    baseUrl: process.env.GCD_WEBHOOK_URL,
    consoleToken: process.env.GCD_WEBHOOK_CONSOLE_TOKEN,
    adminSecret: process.env.GCD_WEBHOOK_ADMIN_SECRET,
    enabled: envFlag(process.env.GCD_WEBHOOK_ENABLED, true),
  },
  {
    id: "gcd-qbo-hub",
    baseUrl: process.env.GCD_QBO_HUB_URL,
    consoleToken: process.env.GCD_QBO_HUB_CONSOLE_TOKEN,
    bearerSecret: process.env.GCD_QBO_HUB_BRIDGE_SECRET,
    enabled: envFlag(process.env.GCD_QBO_HUB_ENABLED, true),
  },
];

export function getAppEntry(id: string): AppEntry | undefined {
  return REGISTRY.find((a) => a.id === id);
}

/** An entry is usable only if it's enabled AND has a base URL configured. */
export function getReadyEntry(id: string): AppEntry | undefined {
  const e = getAppEntry(id);
  if (!e || !e.enabled || !e.baseUrl) return undefined;
  return e;
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}
