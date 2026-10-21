import type { UIMessage } from "ai";
import type { ParsedIntent } from "./intent";
import type { Filters, HubSummary, Origin, ProductSummary, ShopOffer } from "../types";

export interface QuickResults {
  query: string;
  rawText: string;
  intent: ParsedIntent;
  origin: Origin;
  filters: Filters;
  relaxed: string[];
  /** query words ignored because no product title contained them */
  dropped: string[];
  items: ProductSummary[];
  facets: { categories: [string, number][]; brands: [string, number][] };
}

/** Instant "where should I go" answer for one product. */
export interface WherePayload {
  product: ProductSummary;
  hub: HubSummary | null;
  top: ShopOffer[];
  total: number;
  openCount: number;
  visitLabel: string | null;
  trafficZone: boolean;
  /** nobody is open at the planned time; list shows when they open */
  allClosed?: boolean;
}

export interface PicksPayload {
  picks: { productId: string; label: string; reasons: string[]; product: ProductSummary }[];
  question: { text: string; options: string[] } | null;
  followups: string[];
}

export type AgentDataParts = {
  results: QuickResults;
  where: WherePayload;
  intent: { filters: Partial<Filters>; place: ParsedIntent["place"]; chips: string[] };
  status: { stage: "searching" | "thinking" | "done" | "error"; note?: string };
  picks: PicksPayload;
};

export type AgentMessage = UIMessage<never, AgentDataParts>;

export interface ChatContext {
  origin: Origin;
  filters: Filters;
  lastQuery?: string | null;
  /** product the user is looking at when consulting the assistant from a product page */
  focusProductId?: string | null;
}
