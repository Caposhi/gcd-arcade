/**
 * React hook for a tile's /console/stream.
 *
 * We parse the SSE stream with fetch + ReadableStream rather than EventSource,
 * because EventSource only dispatches events whose names were pre-registered
 * via addEventListener — and the /console contract uses the open-ended event
 * `kind` as the SSE event name. Reading frames ourselves and taking `kind` from
 * the JSON payload (which every frame carries) makes the client robust to any
 * event kind without maintaining a hard-coded name list. Reconnects with
 * backoff and resumes from the last id via `?since=`.
 */
import { useEffect, useRef, useState } from "react";
import type { ConsoleEvent } from "@gcd-arcade/shared";
import { streamUrl } from "./bff";

export type StreamStatus = "connecting" | "open" | "error";

export interface UseStreamResult {
  events: ConsoleEvent[];
  status: StreamStatus;
}

export function useStream(appId: string | null, program?: string, max = 120): UseStreamResult {
  const [events, setEvents] = useState<ConsoleEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const localSeq = useRef(0);

  useEffect(() => {
    if (!appId) return;
    setEvents([]);
    setStatus("connecting");
    let lastId = 0;
    let closed = false;
    let attempt = 0;
    const ctrl = new AbortController();

    const push = (dataStr: string, evName: string) => {
      let parsed: ConsoleEvent;
      try {
        parsed = JSON.parse(dataStr) as ConsoleEvent;
      } catch {
        parsed = { id: --localSeq.current, kind: evName || "message", message: dataStr };
      }
      if (parsed.id == null) parsed.id = --localSeq.current;
      else if (parsed.id > lastId) lastId = parsed.id;
      if (!parsed.kind) parsed.kind = evName || "message";
      setEvents((prev) => {
        const next = [...prev, parsed];
        return next.length > max ? next.slice(next.length - max) : next;
      });
    };

    const handleFrame = (frame: string) => {
      let dataStr = "";
      let evName = "";
      for (const raw of frame.split("\n")) {
        const line = raw.replace(/\r$/, "");
        if (!line || line.startsWith(":")) continue; // blank or comment (": ping")
        if (line.startsWith("data:")) dataStr += (dataStr ? "\n" : "") + line.slice(5).replace(/^ /, "");
        else if (line.startsWith("event:")) evName = line.slice(6).trim();
        else if (line.startsWith("id:")) {
          const n = Number(line.slice(3).trim());
          if (Number.isFinite(n)) lastId = Math.max(lastId, n);
        }
      }
      if (dataStr.trim()) push(dataStr, evName);
    };

    const connect = async () => {
      try {
        const res = await fetch(streamUrl(appId, program, lastId || undefined), {
          headers: { accept: "text/event-stream" },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        if (!closed) setStatus("open");
        attempt = 0;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          // frames are separated by a blank line
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            handleFrame(buf.slice(0, idx));
            buf = buf.slice(idx + 2);
          }
        }
        throw new Error("stream ended");
      } catch (err) {
        if (closed || (err as Error)?.name === "AbortError") return;
        setStatus("error");
        attempt += 1;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
        setTimeout(() => {
          if (!closed) {
            setStatus("connecting");
            void connect();
          }
        }, delay);
      }
    };

    void connect();
    return () => {
      closed = true;
      ctrl.abort();
    };
  }, [appId, program, max]);

  return { events, status };
}
