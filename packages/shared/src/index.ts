/**
 * GCD-ARCADE shared types.
 *
 * Two layers live here:
 *  1. The `/console/*` contract every backend app exposes (read-only).
 *  2. The hub-side "tile" model the BFF derives from those manifests and
 *     serves to the XMB front-end.
 *
 * The contract is intentionally permissive: each app's `/console/state` is
 * app-specific, so `ConsoleState` is loosely typed and views narrow it down.
 */

// ---------------------------------------------------------------------------
// 1. The /console/* contract (mirrors GCD-SOCIAL, the reference impl)
// ---------------------------------------------------------------------------

export interface ConsoleTheme {
  /** Up to a few hex colors that define the view's world. */
  palette: string[];
  /** Free-text style hint, e.g. "8-bit shop floor", "neon trading terminal". */
  style: string;
  /** Emoji used as the tile icon. */
  icon: string;
}

/** A single program advertised inside a multi-program manifest (gcd-webhook). */
export interface ConsoleProgram {
  id: string;
  name: string;
  icon?: string;
  /** Optional deep-link to an existing UI for this program. */
  externalUrl?: string;
}

/** `GET /console/manifest` — static identity for an app. */
export interface ConsoleManifest {
  id: string;
  name: string;
  tagline?: string;
  description?: string;
  theme?: ConsoleTheme;
  /** GCD-SOCIAL advertises its agent roster here. */
  agents?: string[];
  /** Multi-program backends (gcd-webhook) advertise their programs here. */
  programs?: ConsoleProgram[];
  /** Link-out to a full existing dashboard, when one exists. */
  externalUrl?: string | null;
  endpoints?: {
    state?: string;
    stream?: string;
  };
}

/** A single SSE frame from `/console/stream`. */
export interface ConsoleEvent {
  id: number;
  /** Multi-program backends tag each event with the owning program. */
  program?: string;
  /** The SSE `event:` name, e.g. "agent:start", "job:completed". */
  kind: string;
  message?: string;
  data?: unknown;
  createdAt?: string;
  /** Convenience: the source app id, stamped by the BFF on pass-through. */
  appId?: string;
}

/** `GET /console/state` — app-specific snapshot. Loosely typed on purpose. */
export interface ConsoleState {
  id?: string;
  recentEvents?: ConsoleEvent[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 2. The hub tile model (BFF → front-end)
// ---------------------------------------------------------------------------

/** Which themed front-end view renders a tile. */
export type ViewKind =
  | "agents"
  | "attribution"
  | "transcripts"
  | "sms-inbox"
  | "automation"
  | "projections" // GCD QBO Hub: Financial Projections' bespoke world
  | "cash-sheet-sync" // GCD QBO Hub: Cash Sheet Sync's bespoke world
  | "assistant" // GCD QBO Hub: AI Report Assistant's bespoke world
  | "coworker-portal" // GCD QBO Hub: Coworker Portal's bespoke world
  | "live" // generic themed live-summary view (foundation default)
  | "placeholder";

export interface Tile {
  /** Stable tile id used in routes, e.g. "gcd-social" or "gcd-webhook:winback". */
  id: string;
  /** The source app this tile reads from (BFF registry id). */
  appId: string;
  /** For multi-program backends, the program id to filter the stream by. */
  program?: string;
  name: string;
  tagline?: string;
  description?: string;
  icon: string;
  theme?: ConsoleTheme;
  view: ViewKind;
  /** Deep-link to an existing full UI, if any. */
  externalUrl?: string | null;
  /** false → render a dim "INSERT COIN / Coming soon" tile. */
  enabled: boolean;
  /** false → app's manifest could not be fetched; render "OFFLINE". */
  online: boolean;
  /** Sub-tiles, for grouping tiles (e.g. Automation Server → its programs). */
  children?: Tile[];
}

/** `GET /api/apps` response. */
export interface AppsResponse {
  tiles: Tile[];
  generatedAt: string;
}
