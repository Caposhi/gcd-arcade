/**
 * Reduces gcd-webhook's /console/state "transcripts" bucket + its SSE events
 * into the state the Call Transcripts world renders. Kept deliberately thin
 * compared to AttributionEngine: the health strip is a handful of scalars
 * console.js already computes server-side (see server.js's
 * getTranscriptStats), so there's no field-probing to do here — the real
 * job is collapsing the noisy raw event stream ("insight analysis finished
 * (exit 0)" repeated on every batch run) into a short, readable activity feed.
 */
import type { ConsoleEvent, ConsoleState } from "@gcd-arcade/shared";

export interface Health {
  totalCalls?: number;
  callsWithTranscript?: number;
  analyzedCount?: number;
  analyzedPct?: number;
  lastAnalyzedAt?: string;
  lastSyncedAt?: string;
  sentiment: { positive: number; neutral: number; negative: number };
  followUpCount?: number;
  authorized?: boolean | null;
}

export interface ActivityItem {
  id: number;
  text: string;
  ok: boolean;
  at: string;
}

const EMPTY_HEALTH: Health = { sentiment: { positive: 0, neutral: 0, negative: 0 } };

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export class TranscriptsEngine {
  private health: Health = EMPTY_HEALTH;
  private activity: ActivityItem[] = [];
  private lastId = 0;

  ingestState(state: ConsoleState): void {
    const bucket = asRecord(asRecord(state.programs)?.transcripts);
    if (!bucket) return;
    const sentiment = asRecord(bucket.sentiment);
    this.health = {
      totalCalls: num(bucket.totalCalls),
      callsWithTranscript: num(bucket.callsWithTranscript),
      analyzedCount: num(bucket.analyzedCount),
      analyzedPct: num(bucket.analyzedPct),
      lastAnalyzedAt: str(bucket.lastAnalyzedAt),
      lastSyncedAt: str(bucket.lastSyncedAt),
      sentiment: {
        positive: num(sentiment?.positive) ?? 0,
        neutral: num(sentiment?.neutral) ?? 0,
        negative: num(sentiment?.negative) ?? 0,
      },
      followUpCount: num(bucket.followUpCount),
      authorized: typeof bucket.authorized === "boolean" ? bucket.authorized : null,
    };
  }

  ingestEvents(events: ConsoleEvent[]): void {
    const ordered = [...events].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));
    for (const ev of ordered) {
      const eid = Number(ev.id);
      if (Number.isFinite(eid)) {
        if (eid <= this.lastId) continue;
        this.lastId = eid;
      }
      this.handle(ev);
    }
  }

  private handle(ev: ConsoleEvent): void {
    const d = asRecord(ev.data);
    const kind = (ev.kind || "").toLowerCase();
    const at = ev.createdAt ?? "";

    if (kind === "sync") {
      const calls = num(d?.count) ?? 0;
      const transcripts = num(d?.transcripts) ?? 0;
      this.push({
        text: transcripts > 0 ? `Synced ${calls} calls, ${transcripts} new transcripts` : `Synced ${calls} calls — no new transcripts`,
        ok: true,
        at,
      });
      return;
    }

    if (kind === "analyze") {
      const exitCode = num(d?.exitCode) ?? 0;
      this.push({
        text: exitCode === 0 ? "Insight analysis completed cleanly" : `Insight analysis failed (exit ${exitCode})`,
        ok: exitCode === 0,
        at,
      });
      return;
    }

    // Unrecognized transcripts-program event kind — still surface it, just
    // verbatim, so nothing silently vanishes as the backend evolves.
    if (ev.message) this.push({ text: ev.message, ok: true, at });
  }

  private push(item: Omit<ActivityItem, "id">): void {
    this.activity = [{ ...item, id: ++this.seq }, ...this.activity].slice(0, 8);
  }
  private seq = 0;

  getHealth(): Health {
    return { ...this.health, sentiment: { ...this.health.sentiment } };
  }
  getActivity(): ActivityItem[] {
    return [...this.activity];
  }
}
