/**
 * Helpers for talking to a backend app's /console/* endpoints. Attaches the
 * per-app console token server-side and never leaks it to callers.
 */
import type { AppEntry } from "./registry.js";
import type { ConsoleManifest, ConsoleState } from "@gcd-arcade/shared";

const FETCH_TIMEOUT_MS = 8000;

/** Build a /console/* URL with the token as ?key= (and return token header too). */
export function consoleUrl(entry: AppEntry, path: string, extra?: Record<string, string>): string {
  const url = new URL(path, entry.baseUrl);
  if (entry.consoleToken) url.searchParams.set("key", entry.consoleToken);
  if (extra) for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  return url.toString();
}

export function consoleHeaders(entry: AppEntry): Record<string, string> {
  const h: Record<string, string> = {};
  if (entry.consoleToken) h["x-console-token"] = entry.consoleToken;
  return h;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", ...headers }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`upstream ${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchManifest(entry: AppEntry): Promise<ConsoleManifest> {
  return fetchJson<ConsoleManifest>(consoleUrl(entry, "/console/manifest"), consoleHeaders(entry));
}

export async function fetchState(entry: AppEntry): Promise<ConsoleState> {
  return fetchJson<ConsoleState>(consoleUrl(entry, "/console/state"), consoleHeaders(entry));
}
