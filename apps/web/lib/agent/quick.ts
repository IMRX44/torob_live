import "server-only";
import { formatClock, tehranClock } from "@torob/core";
import { parseIntent } from "./intent";
import { searchProductsDetailed, facets } from "../server/search";
import { getProductsByIds, shopsForProduct, withNearby } from "../server/catalog";
import type { QuickResults, PicksPayload, WherePayload } from "./messages";
import type { Filters, Origin, ProductSummary } from "../types";

const FOLLOWUP =
  /(مقایسه|کدوم|کدام|کجا|نزدیک ?تر|ارزون ?تر|ارزان ?تر|بپرس|استعلام|مسیر|برنامه|اینا|این ?ها|اولی|دومی|سومی|همین|چرا|توضیح|فرقش|فرق|بهتره|ممنون|مرسی|جواب|تایید|تأیید|رزرو|سفر|لیست)/;

export function looksLikeFollowup(text: string, hasHistory: boolean) {
  return hasHistory && FOLLOWUP.test(text) && text.length < 90;
}

export function visitLabel(f: Filters): string | null {
  if (!f.visitAt) return null;
  const d = new Date(f.visitAt);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  const day = days <= 0 ? "امروز" : days === 1 ? "فردا" : new Intl.DateTimeFormat("fa-IR", { weekday: "long", timeZone: "Asia/Tehran" }).format(d);
  return `${day} ساعت ${formatClock(tehranClock(d).minutes)}`;
}

/** Deterministic first answer: parse, search with graceful relaxation, enrich with nearby counts + key specs. */
export async function quickResults(text: string, origin: Origin, filters: Filters, lastQuery?: string | null): Promise<QuickResults> {
  const intent = parseIntent(text);
  const f: Filters = { ...filters, ...intent.filters };
  const o: Origin = intent.place ? { lat: intent.place.lat, lon: intent.place.lon, label: intent.place.name, source: "preset" } : origin;
  const near = f.radiusKm ? { lat: o.lat, lon: o.lon, radiusM: f.radiusKm * 1000 } : null;

  // Short answers to a clarifying question refine the previous query ("گوشی" → "سامسونگ").
  let q = intent.query;
  const short = q.split(" ").filter(Boolean).length <= 2;
  const candidates = lastQuery && short ? [q ? `${lastQuery} ${q}` : lastQuery, q, lastQuery].filter(Boolean) : [q || text];

  const relaxed: string[] = [];
  let items: ProductSummary[] = [];
  let dropped: string[] = [];
  for (const cand of candidates) {
    const r = await searchProductsDetailed({ q: cand, minPrice: f.minPrice, maxPrice: f.maxPrice, near, installment: f.installment, limit: 18 });
    if (r.items.length) {
      items = r.items;
      dropped = r.dropped;
      q = cand;
      break;
    }
  }
  const retry = async (opts: Parameters<typeof searchProductsDetailed>[0], tag: string) => {
    if (items.length) return;
    const r = await searchProductsDetailed(opts);
    if (r.items.length) {
      items = r.items;
      dropped = r.dropped;
      relaxed.push(tag);
    }
  };
  if (f.installment) await retry({ q, minPrice: f.minPrice, maxPrice: f.maxPrice, near, limit: 18 }, "installment");
  if (near) await retry({ q, minPrice: f.minPrice, maxPrice: f.maxPrice, limit: 18 }, "radius");
  if (f.maxPrice != null || f.minPrice != null) await retry({ q, limit: 18 }, "budget");

  const details = await getProductsByIds(items.slice(0, 12).map((i) => i.id));
  const spec = new Map(details.map((d) => [d.id, d.keySpecs]));
  const enriched = (await withNearby(items, o)).map((i) => ({ ...i, keySpecs: spec.get(i.id) }));
  return { query: q, rawText: text, intent, origin: o, filters: f, relaxed, dropped, items: enriched, facets: facets(items) };
}

/** The product a "where should I go" question most likely means: many sellers near the user, high in ranking. */
export function likelyProduct(items: ProductSummary[]): ProductSummary | null {
  const top = items.slice(0, 6);
  if (!top.length) return null;
  return [...top].sort((a, b) => (b.nearbySellers ?? b.sellerCount) - (a.nearbySellers ?? a.sellerCount))[0]!;
}

export async function whereFor(productId: string, origin: Origin, filters: Filters): Promise<WherePayload | null> {
  const data = await shopsForProduct({ productId, origin, filters });
  if (!data) return null;
  const listed = data.offers.filter((o) => !(o.confirmation && !o.confirmation.available));
  return {
    product: data.product,
    hub: data.hubs[0] && data.hubs[0].sellerCount >= 2 ? data.hubs[0] : null,
    top: listed.slice(0, 3),
    total: data.offers.length,
    openCount: data.offers.filter((o) => o.open.state === "open").length,
    visitLabel: visitLabel(filters),
    trafficZone: data.trafficZone,
  };
}

/** Rule-based picks when the LLM is unavailable: still useful, still honest. */
export function fallbackPicks(items: ProductSummary[]): PicksPayload {
  // Stay inside the category the results are mostly about (no "Bluetooth module" for "earbuds").
  const counts = new Map<string, number>();
  items.slice(0, 10).forEach((i) => counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
  const main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const priced = items.filter((i) => i.priceMin != null && (!main || i.category === main));
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
