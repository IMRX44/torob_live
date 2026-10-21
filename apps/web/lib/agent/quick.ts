import "server-only";
import { parseIntent } from "./intent";
import { searchProducts, facets } from "../server/search";
import { getProductsByIds, withNearby } from "../server/catalog";
import type { QuickResults, PicksPayload } from "./messages";
import type { Filters, Origin, ProductSummary } from "../types";

const FOLLOWUP = /(مقایسه|کدوم|کدام|کجا|نزدیک ?تر|ارزون ?تر|ارزان ?تر|بپرس|استعلام|مسیر|برنامه|اینا|این ?ها|اولی|دومی|سومی|همین|چرا|توضیح|فرقش|فرق|بهتره|بخرم\?|ممنون|مرسی)/;

export function looksLikeFollowup(text: string, hasHistory: boolean) {
  return hasHistory && FOLLOWUP.test(text) && text.length < 80;
}

/** Deterministic first answer: parse, search with graceful relaxation, enrich with nearby counts + key specs. */
export async function quickResults(text: string, origin: Origin, filters: Filters, lastQuery?: string | null): Promise<QuickResults> {
  const intent = parseIntent(text);
  const f: Filters = { ...filters, ...intent.filters };
  const o: Origin = intent.place ? { lat: intent.place.lat, lon: intent.place.lon, label: intent.place.name, source: "preset" } : origin;
  const near = f.radiusKm ? { lat: o.lat, lon: o.lon, radiusM: f.radiusKm * 1000 } : null;

  // Short answers to a clarifying question refine the previous query ("گوشی" → "سامسونگ").
  let q = intent.query;
  const short = q.split(" ").length <= 3;
  const candidates = lastQuery && short && q ? [`${lastQuery} ${q}`, q, lastQuery] : [q || lastQuery || text];

  const relaxed: string[] = [];
  let items: ProductSummary[] = [];
  for (const cand of candidates) {
    items = await searchProducts({ q: cand, minPrice: f.minPrice, maxPrice: f.maxPrice, near, installment: f.installment, limit: 18 });
    if (items.length) {
      q = cand;
      break;
    }
  }
  if (!items.length && f.installment) {
    items = await searchProducts({ q, minPrice: f.minPrice, maxPrice: f.maxPrice, near, limit: 18 });
    if (items.length) relaxed.push("installment");
  }
  if (!items.length && near) {
    items = await searchProducts({ q, minPrice: f.minPrice, maxPrice: f.maxPrice, limit: 18 });
    if (items.length) relaxed.push("radius");
  }
  if (!items.length && (f.maxPrice != null || f.minPrice != null)) {
    items = await searchProducts({ q, limit: 18 });
    if (items.length) relaxed.push("budget");
  }
  const details = await getProductsByIds(items.slice(0, 12).map((i) => i.id));
  const spec = new Map(details.map((d) => [d.id, d.keySpecs]));
  const enriched = (await withNearby(items, o)).map((i) => ({ ...i, keySpecs: spec.get(i.id) }));
  return { query: q, rawText: text, intent, origin: o, filters: f, relaxed, items: enriched, facets: facets(items) };
}

/** Rule-based picks when the LLM is unavailable: still useful, still honest. */
export function fallbackPicks(items: ProductSummary[]): PicksPayload {
  const priced = items.filter((i) => i.priceMin != null);
  const picks: PicksPayload["picks"] = [];
  const add = (p: ProductSummary | undefined, label: string, reasons: string[]) => {
    if (p && !picks.some((x) => x.productId === p.id)) picks.push({ productId: p.id, label, reasons, product: p });
  };
  const popular = [...priced].sort((a, b) => b.sellerCount - a.sellerCount)[0];
  add(popular, "راحت‌ترین برای پیدا کردن", [`${popular?.sellerCount.toLocaleString("fa-IR")} فروشنده دارد`, "شانس موجود بودن بیشتر"]);
  const cheapest = [...priced].sort((a, b) => a.priceMin! - b.priceMin!)[0];
  add(cheapest, "ارزان‌ترین", ["کمترین قیمت ثبت‌شده در نتایج"]);
  const value = [...priced]
    .filter((p) => p.sellerCount >= 2)
    .sort((a, b) => a.priceMedian! / Math.log(2 + a.sellerCount) - b.priceMedian! / Math.log(2 + b.sellerCount))[0];
  add(value, "بهترین ارزش", ["قیمت مناسب با چند فروشنده برای مقایسه"]);
  return { picks, question: null, followups: ["کدوم مغازه نزدیک‌تره؟", "مقایسه‌شون کن", "ارزون‌ترش رو نشون بده"] };
}
