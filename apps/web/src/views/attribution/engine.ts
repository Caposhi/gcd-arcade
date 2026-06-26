/**
 * The trading-desk engine: reduces the Attribution app's /console/state +
 * BullMQ SSE events into a `TerminalState` the neon view renders. Written
 * defensively — the real payload field names aren't known here, so we probe
 * the likely shapes (and the 5 job lanes derive from whatever the feed reports,
 * falling back to the expected pipeline stages). Dramatic beats go to onMoment.
 */
import type { ConsoleEvent, ConsoleState } from "@gcd-arcade/shared";
import { loadDeskSave, persistDeskSave, deskRank, type DeskSave } from "./save";

export type LaneStatus = "idle" | "active" | "completed" | "failed";
export type MomentKind = "match" | "capi" | "failed" | "highroas";

export interface Lane {
  key: string;
  label: string;
  status: LaneStatus;
  progress: number; // 0..100
  lastRunAt?: string;
}

export interface Kpis {
  spend?: number;
  revenue?: number;
  roas?: number;
  cac?: number;
}

export interface Print {
  id: number;
  kind: "match" | "capi" | "attributed" | "failed";
  text: string;
  amount?: number;
  accepted?: boolean;
  at: string;
}

export interface TerminalState {
  kpis: Kpis;
  prevKpis: Kpis;
  dataQuality: { matchRate?: number; capiAcceptance?: number };
  funnel: { leads?: number; matched?: number; attributed?: number; conversions?: number };
  lanes: Lane[];
  prints: Print[];
  roasHistory: number[];
  meters: { bestRoas: number; cleanStreak: number; bestStreak: number; rank: string };
}

export interface Moment {
  kind: MomentKind;
  seq: number;
  amount?: number;
}

// ----------------------------- field probing ------------------------------
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
function rec(v: unknown): Record<string, unknown> {
  return (v ?? {}) as unknown as Record<string, unknown>;
}
function numIn(obj: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return undefined;
}
function strIn(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}
/** Normalize a percentage that may arrive as 0..1 or 0..100. */
function pct(v: number | undefined): number | undefined {
  if (v === undefined) return undefined;
  return v > 0 && v <= 1 ? Math.round(v * 100) : Math.round(v);
}

/** Live event (drives moments + persistent stats) vs. replayed/seeded history
 *  (updates visuals only). No timestamp → treated as live. */
function isFresh(ev: ConsoleEvent): boolean {
  if (!ev.createdAt) return true;
  const t = Date.parse(ev.createdAt);
  return Number.isNaN(t) ? true : Date.now() - t < 25000;
}

// ----------------------------- lane mapping --------------------------------
const DEFAULT_LANES: Lane[] = [
  { key: "ingest", label: "Ingest Meta Stats", status: "idle", progress: 0 },
  { key: "match", label: "Match Leads ↔ ROs", status: "idle", progress: 0 },
  { key: "attribute", label: "Attribute Revenue", status: "idle", progress: 0 },
  { key: "capi", label: "Send CAPI Conversions", status: "idle", progress: 0 },
  { key: "dq", label: "Refresh Data Quality", status: "idle", progress: 0 },
];

/** Fuzzy-map an arbitrary job/queue name to one of the 5 pipeline lanes. */
function laneKeyFor(name: string): string {
  const l = name.toLowerCase();
  if (/(ingest|sync|meta|spend|stats|insight)/.test(l)) return "ingest";
  if (/(match|link|join|lead)/.test(l)) return "match";
  if (/(attribut|revenue|convert.*revenue|roas)/.test(l)) return "attribute";
  if (/(capi|conversion|offline|send|upload)/.test(l)) return "capi";
  if (/(quality|dq|audit|health|metric)/.test(l)) return "dq";
  return "ingest";
}

// ------------------------------- engine ------------------------------------
export class AttributionEngine {
  private save: DeskSave;
  private kpis: Kpis = {};
  private prevKpis: Kpis = {};
  private dataQuality: TerminalState["dataQuality"] = {};
  private funnel: TerminalState["funnel"] = {};
  private lanes: Map<string, Lane> = new Map(DEFAULT_LANES.map((l) => [l.key, { ...l }]));
  private labelOverridden: Set<string> = new Set();
  private prints: Print[] = [];
  private roasHistory: number[] = [];
  private lastId = 0;
  private printSeq = 0;
  private momentSeq = 0;
  private currentFresh = true;

  constructor(private onMoment: (m: Moment) => void) {
    this.save = loadDeskSave();
  }

  ingestState(state: ConsoleState): void {
    this.currentFresh = true; // a state snapshot is always current
    const s = rec(state);
    const k = asRecord(s.kpis) ?? s;
    const next: Kpis = {
      spend: numIn(k, ["spend", "adSpend", "cost"]),
      revenue: numIn(k, ["revenue", "attributedRevenue", "attributed_revenue", "sales"]),
      roas: numIn(k, ["roas", "ROAS"]),
      cac: numIn(k, ["cac", "CAC", "costPerAcquisition"]),
    };
    if (next.roas === undefined && next.revenue !== undefined && next.spend) next.roas = next.revenue / next.spend;
    // keep previous snapshot for up/down arrows
    if (Object.values(this.kpis).some((v) => v !== undefined)) this.prevKpis = this.kpis;
    this.kpis = next;

    if (next.roas !== undefined) {
      this.roasHistory = [...this.roasHistory, next.roas].slice(-48);
      if (next.roas > this.save.bestRoas) {
        this.save.bestRoas = next.roas;
        persistDeskSave(this.save);
        this.emit("highroas");
      }
    }

    const dq = asRecord(s.dataQuality) ?? asRecord(s.data_quality_metrics) ?? s;
    this.dataQuality = {
      matchRate: pct(numIn(dq, ["matchRate", "match_rate", "matchedRate"])),
      capiAcceptance: pct(numIn(dq, ["capiAcceptance", "capi_acceptance", "acceptanceRate", "capiAcceptanceRate"])),
    };

    const fn = asRecord(s.funnel) ?? s;
    this.funnel = {
      leads: numIn(fn, ["leads", "leadCount", "totalLeads"]),
      matched: numIn(fn, ["matched", "matchedLeads", "matches"]),
      attributed: numIn(fn, ["attributed", "attributedConversions", "attributed_conversions"]),
      conversions: numIn(fn, ["conversions", "conversionsSent", "capiSent", "sent"]),
    };

    // Derive lane labels/status from reported jobs, if any.
    const jobs = Array.isArray(s.jobs) ? (s.jobs as unknown[]) : [];
    for (const j of jobs) {
      const job = asRecord(j);
      if (!job) continue;
      const name = strIn(job, ["name", "queue", "job", "id"]);
      if (!name) continue;
      const key = laneKeyFor(name);
      const lane = this.lanes.get(key);
      if (!lane) continue;
      if (!this.labelOverridden.has(key)) {
        lane.label = name;
        this.labelOverridden.add(key);
      }
      const status = strIn(job, ["status", "state"]);
      if (status) lane.status = mapStatus(status);
      lane.lastRunAt = strIn(job, ["lastRunAt", "finishedAt", "completedAt", "ranAt"]) ?? lane.lastRunAt;
    }
  }

  ingestEvents(events: ConsoleEvent[]): void {
    for (const ev of events) {
      if (ev.id <= this.lastId) continue;
      this.lastId = ev.id;
      this.handle(ev);
    }
  }

  private handle(ev: ConsoleEvent): void {
    const kind = (ev.kind || "").toLowerCase();
    this.currentFresh = isFresh(ev);
    const d = asRecord(ev.data);
    const name = strIn(d, ["name", "queue", "job", "id"]) ?? "";

    // job lifecycle → lane state
    if (kind.startsWith("job:")) {
      const key = laneKeyFor(name || kind);
      const lane = this.lanes.get(key);
      if (lane) {
        if (kind === "job:active") {
          lane.status = "active";
          lane.progress = Math.max(lane.progress, 5);
        } else if (kind === "job:progress") {
          lane.status = "active";
          lane.progress = numIn(d, ["progress", "percent", "pct"]) ?? Math.min(95, lane.progress + 15);
        } else if (kind === "job:completed") {
          lane.status = "completed";
          lane.progress = 100;
          lane.lastRunAt = ev.createdAt ?? lane.lastRunAt;
          if (this.currentFresh) {
            this.save.cleanStreak += 1;
            this.save.bestStreak = Math.max(this.save.bestStreak, this.save.cleanStreak);
            persistDeskSave(this.save);
          }
        } else if (kind === "job:failed") {
          lane.status = "failed";
          if (this.currentFresh) {
            this.save.cleanStreak = 0;
            persistDeskSave(this.save);
          }
          this.print({ kind: "failed", text: `${lane.label} FAILED`, at: ev.createdAt ?? "" });
          this.emit("failed");
        }
      }
      return;
    }

    // attribution match / revenue print
    const amount = numIn(d, ["amount", "revenue", "value", "attributedRevenue"]);
    const ro = strIn(d, ["roId", "repairOrderId", "ro", "roNumber"]) ?? numIn(d, ["roId", "repairOrderId", "ro", "roNumber"])?.toString();
    const campaign = strIn(d, ["campaign", "campaignName", "campaign_name", "adset", "ad"]);
    if (kind.includes("match") || kind.includes("attribut") || (amount !== undefined && (ro || campaign))) {
      const parts = ["MATCHED"];
      if (ro) parts.push(`RO #${ro}`);
      if (campaign) parts.push(campaign);
      this.print({ kind: "match", text: parts.join(" ▸ "), amount, at: ev.createdAt ?? "" });
      this.emit("match", amount);
      return;
    }

    // CAPI conversion send
    if (kind.includes("capi") || kind.includes("conversion") || kind.includes("offline")) {
      const accepted = typeof d?.accepted === "boolean" ? (d.accepted as boolean) : !/reject|fail|error/i.test(ev.message ?? "");
      const count = numIn(d, ["count", "sent", "batch"]);
      this.print({
        kind: "capi",
        text: count !== undefined ? `CAPI ▸ ${count} sent` : ev.message ?? "CAPI conversion sent",
        accepted,
        at: ev.createdAt ?? "",
      });
      this.emit("capi");
      return;
    }
  }

  private print(p: Omit<Print, "id">): void {
    this.prints = [{ ...p, id: ++this.printSeq }, ...this.prints].slice(0, 40);
  }
  private emit(kind: MomentKind, amount?: number): void {
    if (!this.currentFresh) return; // no fanfare for replayed/seeded history
    this.onMoment({ kind, seq: ++this.momentSeq, amount });
  }

  getState(): TerminalState {
    const order = DEFAULT_LANES.map((l) => l.key);
    const lanes = order.map((k) => this.lanes.get(k)!).filter(Boolean).map((l) => ({ ...l }));
    return {
      kpis: { ...this.kpis },
      prevKpis: { ...this.prevKpis },
      dataQuality: { ...this.dataQuality },
      funnel: { ...this.funnel },
      lanes,
      prints: [...this.prints],
      roasHistory: [...this.roasHistory],
      meters: {
        bestRoas: this.save.bestRoas,
        cleanStreak: this.save.cleanStreak,
        bestStreak: this.save.bestStreak,
        rank: deskRank(this.save.bestRoas),
      },
    };
  }
}

function mapStatus(raw: string): LaneStatus {
  const l = raw.toLowerCase();
  if (l.includes("active") || l.includes("run") || l.includes("progress")) return "active";
  if (l.includes("complet") || l.includes("success") || l.includes("done") || l.includes("finish")) return "completed";
  if (l.includes("fail") || l.includes("error")) return "failed";
  return "idle";
}
