import { freshnessScore, type Freshness } from "./prices";

/** Everything the ranker knows about one (shop, offer) candidate. */
export interface VisitCandidate {
  price: number | null;
  distanceM: number;
  openState: "open" | "closed" | "unknown";
  /** minutes the shop stays open after arrival; 0 when closed */
  openMinutesAfterArrival: number;
  freshness: Freshness;
  /** other sellers of the same item within walking distance */
  neighbours: number;
  hasWarranty: boolean;
  hasInstallment: boolean;
  listed: boolean; // has an actual offer vs. category-only
  sellerConfirmed?: "available" | "unavailable" | null;
}

export type Priority = "balanced" | "cheapest" | "nearest" | "surest";

const WEIGHTS: Record<Priority, Record<"price" | "distance" | "open" | "trust" | "hub" | "extras", number>> = {
  balanced: { price: 0.28, distance: 0.22, open: 0.18, trust: 0.17, hub: 0.1, extras: 0.05 },
  cheapest: { price: 0.5, distance: 0.12, open: 0.13, trust: 0.13, hub: 0.07, extras: 0.05 },
  nearest: { price: 0.15, distance: 0.45, open: 0.17, trust: 0.12, hub: 0.07, extras: 0.04 },
  surest: { price: 0.14, distance: 0.12, open: 0.24, trust: 0.3, hub: 0.15, extras: 0.05 },
};

export type ReasonCode =
  | "cheapest"
  | "cheap"
  | "nearest"
  | "near"
  | "open_long"
  | "closing_soon"
  | "closed"
  | "confirmed"
  | "fresh_price"
  | "stale_price"
  | "hub"
  | "warranty"
  | "installment"
  | "category_only";

export interface ScoredCandidate<T> {
  item: T;
  score: number; // 0..100
  parts: Record<string, number>;
  reasons: ReasonCode[];
}

/** Ranks candidates and explains each rank with deterministic reason codes. */
export function rankCandidates<T>(
  items: T[],
  get: (t: T) => VisitCandidate,
  priority: Priority = "balanced",
): ScoredCandidate<T>[] {
  const cands = items.map(get);
  const prices = cands.map((c) => c.price).filter((p): p is number => p != null);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minD = Math.min(...cands.map((c) => c.distanceM));
  const w = WEIGHTS[priority];

  const scored = items.map((item, i) => {
    const c = cands[i]!;
    const price = c.price == null ? 0.35 : maxP === minP ? 1 : 1 - (c.price - minP) / (maxP - minP);
    const distance = 1 / (1 + c.distanceM / 1500);
    const open =
      c.openState === "open" ? Math.min(1, 0.55 + c.openMinutesAfterArrival / 240) : c.openState === "unknown" ? 0.4 : 0.05;
    let trust = freshnessScore(c.freshness) * (c.listed ? 1 : 0.35);
    if (c.sellerConfirmed === "available") trust = 1;
    if (c.sellerConfirmed === "unavailable") trust = 0;
    const hub = Math.min(1, c.neighbours / 5);
    const extras = (c.hasWarranty ? 0.5 : 0) + (c.hasInstallment ? 0.5 : 0);
    const parts = { price, distance, open, trust, hub, extras };
    const score =
      100 *
      (w.price * price + w.distance * distance + w.open * open + w.trust * trust + w.hub * hub + w.extras * extras);

    const reasons: ReasonCode[] = [];
    if (c.sellerConfirmed === "available") reasons.push("confirmed");
    if (c.price != null && c.price === minP && prices.length > 1) reasons.push("cheapest");
    else if (c.price != null && price > 0.75 && prices.length > 2) reasons.push("cheap");
    if (c.distanceM === minD && items.length > 1) reasons.push("nearest");
    else if (c.distanceM < 600) reasons.push("near");
    if (c.openState === "closed") reasons.push("closed");
    else if (c.openState === "open" && c.openMinutesAfterArrival < 45) reasons.push("closing_soon");
    else if (c.openState === "open" && c.openMinutesAfterArrival >= 180) reasons.push("open_long");
    if (c.neighbours >= 2) reasons.push("hub");
    if (!c.listed) reasons.push("category_only");
    else if (c.freshness === "fresh") reasons.push("fresh_price");
    else if (c.freshness === "stale") reasons.push("stale_price");
    if (c.hasInstallment) reasons.push("installment");
    if (c.hasWarranty) reasons.push("warranty");
    return { item, score: Math.round(score * 10) / 10, parts, reasons };
  });
  return scored.sort((a, b) => b.score - a.score);
}

export const REASON_LABEL: Record<ReasonCode, string> = {
  cheapest: "ارزان‌ترین",
  cheap: "قیمت خوب",
  nearest: "نزدیک‌ترین",
  near: "نزدیک",
  open_long: "تا چند ساعت باز است",
  closing_soon: "به‌زودی می‌بندد",
  closed: "موقع رسیدن بسته است",
  confirmed: "فروشنده تأیید کرد",
  fresh_price: "قیمت تازه",
  stale_price: "قیمت قدیمی",
  hub: "چند فروشنده کنارش",
  warranty: "گارانتی دارد",
  installment: "خرید قسطی",
  category_only: "فقط صنف مرتبط",
};

/**
 * "Chance of not coming back empty-handed" for a hub: probability that at least one
 * open member actually has the item, treating members as independent.
 */
export function hubSuccessChance(members: { open: boolean; trust: number }[]): number {
  let miss = 1;
  for (const m of members) if (m.open) miss *= 1 - Math.min(0.95, 0.35 + 0.6 * m.trust);
  return 1 - miss;
}
