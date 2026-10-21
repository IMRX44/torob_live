import type { UIMessage } from "ai";
import type { ParsedIntent } from "./intent";
import type { Filters, Origin, ProductSummary } from "../types";

export interface QuickResults {
  query: string;
  rawText: string;
  intent: ParsedIntent;
  origin: Origin;
  filters: Filters;
  relaxed: string[];
  items: ProductSummary[];
  facets: { categories: [string, number][]; brands: [string, number][] };
}

export interface PicksPayload {
  picks: { productId: string; label: string; reasons: string[]; product: ProductSummary }[];
  question: { text: string; options: string[] } | null;
  followups: string[];
}

export type AgentDataParts = {
  results: QuickResults;
  status: { stage: "searching" | "thinking" | "done" | "error"; note?: string };
  picks: PicksPayload;
};

export type AgentMessage = UIMessage<never, AgentDataParts>;

export interface ChatContext {
  origin: Origin;
  filters: Filters;
  lastQuery?: string | null;
}
