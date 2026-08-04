/**
 * Lucide icon lookup. Tiles/events carry a small kebab-case icon id (either
 * looked up here by tile id, or passed straight through for known event/agent
 * icon names) — we render it client-side rather than trusting a raw emoji
 * from a backend manifest, since a curated icon per known id reads far more
 * intentional. Unknown ids fall back to `DEFAULT_ICON` rather than blocking.
 */
import type { ComponentType } from "react";
import {
  Sparkles,
  TrendingUp,
  Workflow,
  PhoneCall,
  MessageSquare,
  LayoutGrid,
  Settings,
  ChevronLeft,
  PhoneIncoming,
  FileText,
  CheckCircle,
  XCircle,
  Star,
  RefreshCcw,
  CalendarClock,
  BarChart3,
  PenTool,
  Wand2,
  Search,
  ClipboardCheck,
  LayoutTemplate,
  Send,
  Image as ImageIcon,
  type LucideProps,
} from "lucide-react";

export const DEFAULT_ICON = "layout-grid";

/**
 * Tile id → icon id. Keyed against the *real* tile ids the BFF emits
 * (apps/bff/src/tiles.ts), not the app/backend id — gcd-webhook's grouping
 * tile is `gcd-webhook:automation`, transcripts is `gcd-webhook:transcripts`,
 * and the attribution tile id is `attribution` (no "german-car-depot-" prefix).
 */
export const APP_ICON: Record<string, string> = {
  "gcd-social": "sparkles",
  attribution: "trending-up",
  "gcd-webhook:automation": "workflow",
  "gcd-webhook:transcripts": "phone-call",
  "gcd-webhook:sms-inbox": "message-square",
};

/** Every icon id referenced by a tile lookup or an event/agent icon field. */
const REGISTRY: Record<string, ComponentType<LucideProps>> = {
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  workflow: Workflow,
  "phone-call": PhoneCall,
  "message-square": MessageSquare,
  "layout-grid": LayoutGrid,
  settings: Settings,
  "chevron-left": ChevronLeft,
  "phone-incoming": PhoneIncoming,
  "file-text": FileText,
  "check-circle": CheckCircle,
  "x-circle": XCircle,
  star: Star,
  "refresh-ccw": RefreshCcw,
  "calendar-clock": CalendarClock,
  "bar-chart-3": BarChart3,
  "pen-tool": PenTool,
  "wand-2": Wand2,
  search: Search,
  "clipboard-check": ClipboardCheck,
  "layout-template": LayoutTemplate,
  send: Send,
  image: ImageIcon,
};

/** Resolve a kebab-case icon id to its Lucide component, or the default. */
export function iconFor(id: string | undefined): ComponentType<LucideProps> {
  return (id && REGISTRY[id]) || REGISTRY[DEFAULT_ICON];
}

/** Renders a tile's icon by tile id, falling back to `DEFAULT_ICON`. */
export function AppIcon({ tileId, ...props }: { tileId: string } & LucideProps) {
  const Icon = iconFor(APP_ICON[tileId] ?? DEFAULT_ICON);
  return <Icon {...props} />;
}
