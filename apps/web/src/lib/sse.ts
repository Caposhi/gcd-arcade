/** React hook wrapping EventSource for a tile's /console/stream. */
import { useEffect, useRef, useState } from "react";
import type { ConsoleEvent } from "@gcd-arcade/shared";
import { streamUrl } from "./bff";

export type StreamStatus = "connecting" | "open" | "error";

export interface UseStreamResult {
  events: ConsoleEvent[];
  status: StreamStatus;
}

/**
 * Subscribe to a tile's event stream. Keeps the most recent `max` events.
 * EventSource auto-reconnects; we surface connection status for the view.
 */
export function useStream(appId: string | null, program?: string, max = 80): UseStreamResult {
  const [events, setEvents] = useState<ConsoleEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const seq = useRef(0);

  useEffect(() => {
    if (!appId) return;
    setEvents([]);
    setStatus("connecting");
    const es = new EventSource(streamUrl(appId, program));

    const push = (raw: string, kind: string) => {
      let parsed: ConsoleEvent;
      try {
        parsed = JSON.parse(raw) as ConsoleEvent;
      } catch {
        parsed = { id: --seq.current, kind, message: raw };
      }
      if (parsed.id == null) parsed.id = --seq.current;
      if (!parsed.kind) parsed.kind = kind;
      setEvents((prev) => {
        const next = [...prev, parsed];
        return next.length > max ? next.slice(next.length - max) : next;
      });
    };

    es.onopen = () => setStatus("open");
    es.onerror = () => setStatus("error");
    // Default (unnamed) events.
    es.onmessage = (e) => push(e.data, "message");
    // Named events: the contract uses the `kind` as the SSE event name. We
    // can't enumerate every kind ahead of time, so listen broadly via a set
    // of known names plus a catch-all by re-binding on first sight.
    for (const name of KNOWN_EVENT_NAMES) {
      es.addEventListener(name, (e) => push((e as MessageEvent).data, name));
    }

    return () => es.close();
  }, [appId, program, max]);

  return { events, status };
}

// Event names emitted across the GCD apps' /console/stream feeds. Unknown
// names still arrive via onmessage when servers omit an explicit event name.
const KNOWN_EVENT_NAMES = [
  // gcd-social
  "brief:start",
  "agent:start",
  "agent:done",
  "image:done",
  "critic:verdict",
  "brief:awaiting_approval",
  "brief:published",
  "brief:escalated",
  // attribution
  "job:active",
  "job:completed",
  "job:failed",
  "job:progress",
  // gcd-webhook (programs)
  "sync",
  "sms",
  "zerobounce",
  "removed",
  "created",
  "open",
  "click",
  "console:error",
];
