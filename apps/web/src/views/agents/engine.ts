/**
 * The agency engine: reduces GCD-SOCIAL's live SSE events + periodic state
 * snapshot into an `OfficeState` the view renders. Written defensively — the
 * exact field names in the real feed's payloads aren't known here, so we probe
 * the likely shapes and fall back gracefully. Dramatic beats are emitted to an
 * `onMoment` callback (the view turns those into sound + overlays).
 */
import type { ConsoleEvent, ConsoleState } from "@gcd-arcade/shared";
import { PIPELINE, characterFor } from "./cast";
import { loadSave, persistSave, levelFromXp, XP_PER_POST, type AgencySave } from "./save";

export type AgentStatus = "idle" | "working" | "done";
export type BriefStatus = "running" | "awaiting" | "published" | "escalated";
export type MomentKind = "published" | "fail" | "escalated" | "levelup" | "stamp" | "work";

export interface PublishedPost {
  id: string;
  caption?: string;
  imageUrl?: string;
  at: string;
}

export interface BriefView {
  id: string;
  phaseIndex: number;
  activeAgent?: string;
  caption?: string;
  imageUrl?: string;
  verdict?: "PASS" | "FAIL";
  status: BriefStatus;
}

export interface Platform {
  id: string;
  label: string;
  active: boolean;
}

export interface Meters {
  level: number;
  xpInto: number;
  xpSpan: number;
  reputation: number; // 0..100
  buzz: number;
  posts: number;
  streak: number;
  bestStreak: number;
}

export interface OfficeState {
  agents: Record<string, AgentStatus>;
  agentMsg: Record<string, string | undefined>;
  brief: BriefView | null;
  running: boolean;
  queueCount: number;
  publishedPosts: PublishedPost[];
  meters: Meters;
  mode: string;
  platforms: Platform[];
  tokenHealth: "ok" | "warn" | "down" | "unknown";
}

export interface Moment {
  kind: MomentKind;
  seq: number;
  level?: number;
}

// ----------------------------- field probing ------------------------------
function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
/** Treat any object as a loose record (events carry fields beyond the type). */
function rec(v: unknown): Record<string, unknown> {
  return (v ?? {}) as unknown as Record<string, unknown>;
}
function firstString(obj: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}
function firstNumber(obj: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

const CAPTION_KEYS = ["caption", "text", "copy", "body", "content", "post", "message"];
const IMAGE_KEYS = ["imageUrl", "image", "url", "thumbnail", "thumb", "src", "asset"];

function extractCaption(data: unknown): string | undefined {
  const d = asRecord(data);
  return firstString(d, CAPTION_KEYS) ?? firstString(asRecord(d?.brief), CAPTION_KEYS) ?? firstString(asRecord(d?.post), CAPTION_KEYS);
}
function extractImage(data: unknown): string | undefined {
  const d = asRecord(data);
  const direct = firstString(d, IMAGE_KEYS) ?? firstString(asRecord(d?.image), IMAGE_KEYS) ?? firstString(asRecord(d?.post), IMAGE_KEYS);
  return direct && /^https?:\/\//.test(direct) ? direct : direct;
}
function briefIdOf(ev: ConsoleEvent): string {
  const d = asRecord(ev.data);
  const top = rec(ev);
  return (
    (typeof top.runId === "string" && top.runId) ||
    firstString(d, ["runId", "briefId", "id"]) ||
    "brief"
  ) as string;
}

function normalizeMode(state: ConsoleState): string {
  const raw =
    firstString(state as Record<string, unknown>, ["phase", "autonomy", "mode"]) ??
    firstString(asRecord(state.autonomy), ["phase", "mode", "level"]);
  if (!raw) return "—";
  const l = raw.toLowerCase();
  if (l.includes("auto") || l.includes("publish")) return "AUTOPILOT";
  if (l.includes("assist") || l.includes("review") || l.includes("approval") || l.includes("suggest")) return "ASSISTED";
  if (l.includes("manual") || l.includes("off") || l.includes("paused")) return "MANUAL";
  return raw.toUpperCase().slice(0, 12);
}

function normalizePlatforms(state: ConsoleState): Platform[] {
  const known: Record<string, string> = { instagram: "IG", facebook: "FB", ig: "IG", fb: "FB" };
  const raw = (state.platforms ?? (state as Record<string, unknown>).activePlatforms) as unknown;
  const out: Platform[] = [];
  if (Array.isArray(raw)) {
    for (const p of raw) {
      const id = typeof p === "string" ? p : (asRecord(p)?.id as string) ?? "";
      const active = typeof p === "string" ? true : Boolean(asRecord(p)?.active ?? true);
      if (id) out.push({ id, label: known[id.toLowerCase()] ?? id.slice(0, 2).toUpperCase(), active });
    }
  } else if (asRecord(raw)) {
    for (const [id, v] of Object.entries(asRecord(raw)!)) {
      out.push({ id, label: known[id.toLowerCase()] ?? id.slice(0, 2).toUpperCase(), active: Boolean(v) });
    }
  }
  return out.length ? out : [
    { id: "instagram", label: "IG", active: true },
    { id: "facebook", label: "FB", active: true },
  ];
}

function normalizeTokenHealth(state: ConsoleState): OfficeState["tokenHealth"] {
  const probe =
    asRecord((state as Record<string, unknown>).tokenHealth) ??
    asRecord((state as Record<string, unknown>).ig) ??
    asRecord((state as Record<string, unknown>).instagram) ??
    asRecord((state as Record<string, unknown>).token);
  const status =
    firstString(probe, ["status", "state", "health"]) ??
    firstString(state as Record<string, unknown>, ["tokenHealth", "igTokenHealth"]);
  const healthy =
    (probe && typeof probe.healthy === "boolean" ? (probe.healthy as boolean) : undefined) ??
    (typeof (state as Record<string, unknown>).igTokenHealthy === "boolean"
      ? ((state as Record<string, unknown>).igTokenHealthy as boolean)
      : undefined);
  if (healthy === true) return "ok";
  if (healthy === false) return "down";
  if (status) {
    const l = status.toLowerCase();
    if (l.includes("ok") || l.includes("healthy") || l.includes("valid") || l.includes("active")) return "ok";
    if (l.includes("warn") || l.includes("expir") || l.includes("soon")) return "warn";
    if (l.includes("down") || l.includes("invalid") || l.includes("error") || l.includes("expired")) return "down";
  }
  return "unknown";
}

/** A live event (drives moments + persistent stats) vs. a replayed/seeded one
 *  from history (updates visual state only). Events without a timestamp are
 *  treated as live. */
function isFresh(ev: ConsoleEvent): boolean {
  if (!ev.createdAt) return true;
  const t = Date.parse(ev.createdAt);
  return Number.isNaN(t) ? true : Date.now() - t < 25000;
}

function publishedFromState(state: ConsoleState): number | undefined {
  return (
    firstNumber(state as Record<string, unknown>, ["published", "postsPublished", "totalPublished"]) ??
    firstNumber(asRecord((state as Record<string, unknown>).counts), ["published", "postsPublished"]) ??
    firstNumber(asRecord((state as Record<string, unknown>).briefQueue), ["published"])
  );
}
function queueFromState(state: ConsoleState): number {
  return (
    firstNumber(state as Record<string, unknown>, ["queued", "pending", "backlog"]) ??
    firstNumber(asRecord((state as Record<string, unknown>).counts), ["queued", "pending"]) ??
    firstNumber(asRecord((state as Record<string, unknown>).briefQueue), ["queued", "pending", "size", "length"]) ??
    0
  );
}

// ------------------------------- engine ------------------------------------
export class AgencyEngine {
  private save: AgencySave;
  private agents: Record<string, AgentStatus> = {};
  private agentMsg: Record<string, string | undefined> = {};
  private brief: BriefView | null = null;
  private publishedPosts: PublishedPost[] = [];
  private queueCount = 0;
  private mode = "—";
  private platforms: Platform[] = normalizePlatforms({});
  private tokenHealth: OfficeState["tokenHealth"] = "unknown";
  private lastId = 0;
  private momentSeq = 0;
  private currentFresh = true;

  constructor(private onMoment: (m: Moment) => void) {
    this.save = loadSave();
    for (const id of PIPELINE) this.agents[id] = "idle";
  }

  ingestState(state: ConsoleState): void {
    this.mode = normalizeMode(state);
    this.platforms = normalizePlatforms(state);
    this.tokenHealth = normalizeTokenHealth(state);
    this.queueCount = queueFromState(state);
    const pub = publishedFromState(state);
    if (pub !== undefined && pub > this.save.lifetimePublished) {
      // Adopt a higher authoritative count without minting fake XP retroactively.
      this.save.lifetimePublished = pub;
      persistSave(this.save);
    }
  }

  ingestEvents(events: ConsoleEvent[]): void {
    // Process oldest→newest; recentEvents may arrive in either order.
    for (const ev of [...events].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
      if (ev.id <= this.lastId) continue;
      this.lastId = ev.id;
      this.handle(ev);
    }
  }

  private setBrief(ev: ConsoleEvent): void {
    this.brief = { id: briefIdOf(ev), phaseIndex: 0, status: "running" };
    for (const id of PIPELINE) this.agents[id] = "idle";
    this.agentMsg = {};
    const cap = extractCaption(ev.data);
    const img = extractImage(ev.data);
    if (cap) this.brief.caption = cap;
    if (img) this.brief.imageUrl = img;
  }

  private absorbContent(ev: ConsoleEvent): void {
    if (!this.brief) return;
    const cap = extractCaption(ev.data);
    const img = extractImage(ev.data);
    if (cap) this.brief.caption = cap;
    if (img) this.brief.imageUrl = img;
  }

  private handle(ev: ConsoleEvent): void {
    const kind = ev.kind || "";
    this.currentFresh = isFresh(ev);
    this.absorbContent(ev);

    if (kind === "brief:start") {
      this.setBrief(ev);
      return;
    }
    if (!this.brief && /^(agent:|image:|critic:|brief:)/.test(kind)) {
      // Stream resumed mid-brief; synthesize one so the office isn't empty.
      this.setBrief(ev);
    }

    if (kind === "agent:start") {
      const agent = (asRecord(ev.data)?.agent as string) ?? (rec(ev).agent as string);
      const ch = characterFor(agent);
      const id = ch?.id ?? agent;
      if (id) {
        this.agents[id] = "working";
        this.agentMsg[id] = ev.message;
        const idx = PIPELINE.indexOf(id);
        if (this.brief && idx >= 0) {
          this.brief.activeAgent = id;
          this.brief.phaseIndex = idx;
          this.brief.status = "running";
        }
        this.emit("work");
      }
      return;
    }
    if (kind === "agent:done") {
      const agent = (asRecord(ev.data)?.agent as string) ?? (rec(ev).agent as string);
      const id = characterFor(agent)?.id ?? agent;
      if (id) this.agents[id] = "done";
      return;
    }
    if (kind === "image:done") {
      this.agents["image"] = "done";
      return;
    }
    if (kind === "critic:verdict") {
      const verdict = firstString(asRecord(ev.data), ["verdict", "result", "status"]) ?? ev.message ?? "";
      const pass = /pass|ok|approve|true/i.test(verdict);
      this.agents["brand-compliance-critic"] = "done";
      if (this.brief) {
        this.brief.verdict = pass ? "PASS" : "FAIL";
        // FAIL → send-back: token returns to the copywriter to rework
        if (!pass) this.brief.phaseIndex = Math.min(this.brief.phaseIndex, PIPELINE.indexOf("copywriter"));
      }
      if (this.currentFresh) {
        this.save.verdictCount += 1;
        if (pass) this.save.passCount += 1;
        persistSave(this.save);
      }
      this.emit(pass ? "stamp" : "fail");
      return;
    }
    if (kind === "brief:awaiting_approval") {
      if (this.brief) this.brief.status = "awaiting";
      return;
    }
    if (kind === "brief:published") {
      if (this.brief) {
        this.brief.status = "published";
        this.agents["posting"] = "done";
      }
      // Always reflect the shipped post visually (de-duped by id below).
      const postId = this.brief?.id ?? `post-${this.lastId}`;
      if (!this.publishedPosts.some((p) => p.id === postId)) {
        this.publishedPosts.unshift({
          id: postId,
          caption: this.brief?.caption,
          imageUrl: this.brief?.imageUrl,
          at: ev.createdAt ?? "",
        });
        this.publishedPosts = this.publishedPosts.slice(0, 6);
      }
      // Only count + celebrate genuinely live publishes (not history replays).
      if (this.currentFresh) {
        const before = levelFromXp(this.save.xp).level;
        this.save.lifetimePublished += 1;
        this.save.xp += XP_PER_POST;
        this.save.streak += 1;
        this.save.bestStreak = Math.max(this.save.bestStreak, this.save.streak);
        this.save.lastPublishedAt = ev.createdAt ?? null;
        persistSave(this.save);
        this.emit("published");
        const after = levelFromXp(this.save.xp).level;
        if (after > before) this.emit("levelup", after);
      }
      return;
    }
    if (kind === "brief:escalated") {
      if (this.brief) this.brief.status = "escalated";
      if (this.currentFresh) {
        this.save.streak = 0;
        persistSave(this.save);
      }
      this.emit("escalated");
      return;
    }
  }

  private emit(kind: MomentKind, level?: number): void {
    if (!this.currentFresh) return; // no fanfare for replayed/seeded history
    this.onMoment({ kind, seq: ++this.momentSeq, level });
  }

  getState(): OfficeState {
    const lvl = levelFromXp(this.save.xp);
    const reputation = this.save.verdictCount > 0 ? Math.round((this.save.passCount / this.save.verdictCount) * 100) : 100;
    const posts = this.save.lifetimePublished;
    const buzz = Math.round(this.save.xp * 0.6 + this.save.passCount * 5 + this.save.bestStreak * 8);
    const running = !!this.brief && (this.brief.status === "running" || this.brief.status === "awaiting");
    return {
      agents: { ...this.agents },
      agentMsg: { ...this.agentMsg },
      brief: this.brief ? { ...this.brief } : null,
      running,
      queueCount: this.queueCount,
      publishedPosts: [...this.publishedPosts],
      meters: {
        level: lvl.level,
        xpInto: lvl.into,
        xpSpan: lvl.span,
        reputation,
        buzz,
        posts,
        streak: this.save.streak,
        bestStreak: this.save.bestStreak,
      },
      mode: this.mode,
      platforms: this.platforms,
      tokenHealth: this.tokenHealth,
    };
  }
}
