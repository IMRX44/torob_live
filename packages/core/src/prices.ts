/** Price quality and freshness, so "registered price" is never mistaken for "confirmed". */

export type PriceQuality = "valid" | "missing" | "outlier";

const MIN_TOMAN = 1_000;
const MAX_TOMAN = 50_000_000_000; // 50 billion toman

export function priceQuality(price: number | null | undefined): PriceQuality {
  if (price == null || !Number.isFinite(price) || price <= 0) return "missing";
  if (price < MIN_TOMAN || price > MAX_TOMAN) return "outlier";
  return "valid";
}

export type Freshness = "confirmed" | "fresh" | "recent" | "aging" | "stale" | "unknown";

export function freshnessOf(changedAt: Date | string | null | undefined, now = new Date(), confirmed = false): Freshness {
  if (confirmed) return "confirmed";
  if (!changedAt) return "unknown";
  const d = typeof changedAt === "string" ? new Date(changedAt) : changedAt;
  const days = (now.getTime() - d.getTime()) / 86_400_000;
  if (days <= 3) return "fresh";
  if (days <= 14) return "recent";
  if (days <= 90) return "aging";
  return "stale";
}

/** 0..1 confidence that a registered price still holds. */
export function freshnessScore(f: Freshness): number {
  return { confirmed: 1, fresh: 0.9, recent: 0.75, aging: 0.45, stale: 0.15, unknown: 0.3 }[f];
}

export interface PriceStats {
  count: number;
  min: number;
  max: number;
  median: number;
}

export function priceStats(prices: number[]): PriceStats | null {
  const v = prices.filter((p) => priceQuality(p) === "valid").sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  const median = v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
  return { count: v.length, min: v[0]!, max: v[v.length - 1]!, median };
}

/**
 * Flags a price that is implausibly far from its peers (likely a stale or mistyped entry).
 * Needs at least 3 valid peers to judge.
 */
export function isSuspicious(price: number, stats: PriceStats | null): "low" | "high" | null {
  if (!stats || stats.count < 3) return null;
  if (price < stats.median * 0.45) return "low";
  if (price > stats.median * 2.2) return "high";
  return null;
}

/** Position of price within [min,max] in 0..1, for the fair-price bar. */
export function pricePosition(price: number, stats: PriceStats | null): number | null {
  if (!stats || stats.max === stats.min) return null;
  return Math.min(1, Math.max(0, (price - stats.min) / (stats.max - stats.min)));
}
