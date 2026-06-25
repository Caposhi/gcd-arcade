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

/** Build the SSE URL for a tile's stream (optionally filtered by program). */
export function streamUrl(appId: string, program?: string): string {
  const u = new URL(url(`/api/apps/${encodeURIComponent(appId)}/stream`), window.location.origin);
  if (program) u.searchParams.set("program", program);
  return u.toString();
}
