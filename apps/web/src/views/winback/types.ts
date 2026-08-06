/**
 * Declined-Job Win-Back — mirrors gcd-webhook's
 * /api/admin/winback/insights bridge response. A separate namespace from
 * views/qbo/types.ts on purpose: this is a gcd-webhook Automation Server
 * program, not a QBO Hub module, and has no shared AI-assistant infra —
 * `WinbackInsight` deliberately has no `prompt` field, since there's no
 * chat panel here to feed it into (see WinbackView.tsx's header comment).
 */

export interface WinbackSnapshot {
  total: number;
  remindersSent: number;
  pending: number;
  eligible: number;
  remindersPaused: boolean;
}

export interface WinbackCategory {
  category: string;
  count: number;
  declinedValue: number;
}

export interface WinbackTrendPoint {
  period: string;
  declinedCount: number;
  declinedValue: number;
  remindersSent: number;
}

export interface WinbackAttentionRow {
  jobId: string;
  repairOrderNumber: string | null;
  customerName: string | null;
  jobName: string | null;
  jobCategory: string | null;
  estimatedTotal: number;
  declinedAt: string | null;
  offerExpiresAt: string | null;
  discountOffered: number | null;
}

export interface WinbackInsight {
  tone: "good" | "watch" | "bad" | "info";
  text: string;
}

export interface WinbackBridgeResponse {
  snapshot: WinbackSnapshot;
  byCategory: WinbackCategory[];
  trend: WinbackTrendPoint[];
  attention: {
    eligibleNotReminded: WinbackAttentionRow[];
    offerExpiringSoon: WinbackAttentionRow[];
  };
  insights: WinbackInsight[];
}

export type WinbackWindowDays = 30 | 90 | 365;
