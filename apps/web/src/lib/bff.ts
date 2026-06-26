/** Thin client for the BFF. The browser never talks to backends directly. */
import type { AppsResponse, ConsoleState } from "@gcd-arcade/shared";

const BASE = (import.meta.env.VITE_BFF_URL ?? "").replace(/\/$/, "");

function url(path: string): string {
  return `${BASE}${path}`;
}

export async function fetchApps(): Promise<AppsResponse> {
  const res = await fetch(url("/api/apps"));
  if (!res.ok) throw new Error(`/api/apps ${res.status}`);
  return (await res.json()) as AppsResponse;
}

export async function fetchState(appId: string): Promise<ConsoleState> {
  const res = await fetch(url(`/api/apps/${encodeURIComponent(appId)}/state`));
  if (!res.ok) throw new Error(`/api/apps/${appId}/state ${res.status}`);
  return (await res.json()) as ConsoleState;
}

/** Resolve a tile's link-out href: absolute URLs pass through; relative BFF
 *  paths (e.g. the /open redirect) are resolved against the BFF base. */
export function externalHref(externalUrl: string): string {
  return externalUrl.startsWith("/") ? `${BASE}${externalUrl}` : externalUrl;
}

/** Build the SSE URL for a tile's stream (optionally filtered by program,
 *  optionally resuming after a cursor id). */
export function streamUrl(appId: string, program?: string, since?: number): string {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/stream`), window.location.origin);
  if (program) u.searchParams.set("program", program);
  if (since) u.searchParams.set("since", String(since));
  return u.toString();
}
