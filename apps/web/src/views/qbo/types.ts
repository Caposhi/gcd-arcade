/**
 * Mirror types for gcd-qbo-hub's Financial Projections reporting bridge
 * (/api/external/reporting via the BFF). Field names match that repo's
 * src/lib/projections/reports/* + src/lib/assistant/insights.ts exactly —
 * kept as plain mirrors (not a shared package) since the two repos deploy
 * independently; if the hub's shape changes, update these alongside it.
 */

export type KpiFormat = "money" | "percent";
export type Direction = "up" | "down" | "flat";
export type Sentiment = "good" | "bad" | "neutral";

export interface Delta {
  current: number;
  previous: number;
  absolute: number;
  pct: number | null;
  direction: Direction;
  sentiment: Sentiment;
}

export interface Kpi {
  key: string;
  label: string;
  format: KpiFormat;
  value: number;
  polarity: "higher_better" | "lower_better" | "neutral";
  delta: Delta;
}

export interface TrendPoint {
  period: string;
  revenue: number;
  netIncome: number;
}

export interface CategoryDatum {
  name: string;
  value: number;
}

export interface AgingRow {
  name: string;
  id?: string;
  buckets: number[];
  total: number;
}

export interface AgingNormalized {
  asOf?: string;
  bucketLabels: string[];
  totals: number[];
  total: number;
  rows: AgingRow[];
}

export interface BalanceSheetSummary {
  cash: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface ReportFiltersDto {
  preset: string;
  comparison: string;
  method: string;
  granularity?: string;
  customStart?: string;
  customEnd?: string;
}

export interface ReportingConnected {
  connected: true;
  range: DateRange;
  comparison: DateRange;
  filters: ReportFiltersDto;
  kpis: Kpi[];
  trend: TrendPoint[];
  expenseBreakdown: CategoryDatum[];
  revenueByCustomer: CategoryDatum[];
  revenueByItem: CategoryDatum[];
  arAging: AgingNormalized;
  apAging: AgingNormalized;
  balanceSheet: BalanceSheetSummary;
  fetchedAt: string;
}

export interface ReportingUnavailable {
  connected: false;
  range: DateRange;
  comparison: DateRange;
  filters: ReportFiltersDto;
  reason: "not_connected" | "reconnect_required";
}

export type ReportingResult = ReportingConnected | ReportingUnavailable;

/** GCD Pal's deterministic per-module insight bullets (bad→watch→good→info). */
export type PalTone = "good" | "watch" | "bad" | "info";
export interface PalInsight {
  tone: PalTone;
  text: string;
  prompt: string;
}

export interface ReportingBridgeResponse {
  reporting: ReportingResult;
  insights: PalInsight[];
}

export type RangePreset = "this_month" | "last_month" | "this_quarter" | "ytd" | "trailing_12" | "custom";
export type ComparisonMode = "prior_period" | "prior_year";
export type AccountingMethodDto = "accrual" | "cash";
export type GranularityDto = "month" | "quarter" | "year";

// --------------------------- Cash Sheet Sync bridge ---------------------------
// Mirrors gcd-qbo-hub's src/app/api/external/cash-sheet-sync/route.ts.

export interface CssLastRun {
  startedAt: string;
  mode: string;
  status: string;
  rowsScanned: number;
  rowsPosted: number;
  rowsSkipped: number;
  rowsError: number;
  rowsWarning: number;
  tabsScanned: string[];
}

export interface CssAttention {
  possibleDuplicates: number;
  duplicateRowIds: number;
  unknownPurpose: number;
  missingAccountMapping: number;
  missingPayeeMapping: number;
  changedAfterPosting: number;
  removedAfterPosting: number;
  auditOnly: number;
  awaitingQboMatch: number;
  error: number;
}

export interface CssSnapshot {
  rolloutStage: string;
  environment: string;
  lastRun: CssLastRun | null;
  attention: CssAttention;
}

export interface CssTrendPoint {
  period: string;
  rowsPosted: number;
  volumePosted: number;
  rowsError: number;
  rowsDuplicate: number;
}

export interface CssException {
  id: string;
  tab: string;
  row: number;
  status: string;
  date: string | null;
  name: string | null;
  purpose: string | null;
  amount: number;
  url: string | null;
}

export interface CssRecentEdit {
  id: string;
  when: string;
  tab: string | null;
  row: number | null;
  url: string | null;
  fields: string[];
  message: string | null;
}

export interface CssPayee {
  name: string;
  amount: number;
  count: number;
}

export interface CashSheetSyncBridgeResponse {
  snapshot: CssSnapshot;
  trend: CssTrendPoint[];
  exceptions: CssException[];
  recentEdits: CssRecentEdit[];
  payeeLeaderboard: CssPayee[];
  insights: PalInsight[];
}

export type CssWindowDays = 30 | 90 | 365;
export type CssGranularity = "week" | "month" | "year";
