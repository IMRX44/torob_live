import "server-only";
import {
  DAY_LABEL,
  bbox,
  clusterCompact,
  estimateEta,
  formatClock,
  freshnessOf,
  freshnessScore,
  haversine,
  hubSuccessChance,
  inTrafficZone,
  isSuspicious,
  openStatusAt,
  parseWeeklyHours,
  priceStats,
  rankCandidates,
  tehranClock,
  type LatLon,
  type PaymentOption,
} from "@torob/core";
import { sql } from "./db";
import { toSummary } from "./search";
import type {
  Confirmation,
  Filters,
  HubSummary,
  OpenInfo,
  Origin,
  ProductDetail,
  ProductSummary,
  ShopOffer,
  ShopSummary,
  ShopsForProduct,
  SpecRow,
  Warranty,
} from "../types";

export type ShopRow = {
  id: string;
  name: string;
  name_is_real: boolean;
  address: string;
  area: string | null;
  lat: number;
  lon: number;
  categories: string[];
  phone: string | null;
  instagram: string | null;
  website: string | null;
  fast_delivery: boolean | null;
  hours: unknown;
  payments: PaymentOption[];
  mall_id: string | null;
  mall_name: string | null;
  floor: number | null;
  unit: string | null;
  offer_count: number;
};

export const shopCols = () => sql()`s.id, s.name, s.name_is_real, s.address, s.area, s.lat, s.lon, s.categories,
  s.phone, s.instagram, s.website, s.fast_delivery, s.hours, s.payments, s.mall_id, s.mall_name,
  s.floor, s.unit, s.offer_count`;

export function toShop(r: ShopRow): ShopSummary {
  return {
    id: r.id,
    name: r.name,
    nameIsReal: r.name_is_real,
    address: r.address,
    area: r.area,
    lat: r.lat,
    lon: r.lon,
    mallId: r.mall_id,
    mallName: r.mall_name,
    floor: r.floor,
    unit: r.unit,
    phone: r.phone,
    instagram: r.instagram,
    website: r.website,
    fastDelivery: r.fast_delivery,
    payments: r.payments ?? [],
    hours: parseWeeklyHours(r.hours),
    categories: r.categories ?? [],
    offerCount: r.offer_count,
  };
}

/** Human label for opening state at a moment (usually: arrival time). */
export function openInfo(shop: ShopSummary, at: Date, override?: { today_close: string | null; note: string | null } | null): OpenInfo {
  const st = openStatusAt(shop.hours, at);
  const nowMin = tehranClock(at).minutes;
  if (override?.today_close) {
    const [h, m] = override.today_close.split(":").map(Number);
    const close = (h ?? 0) * 60 + (m ?? 0);
    const open = nowMin < close;
    return {
      state: open ? "open" : "closed",
      label: open ? `امروز تا ${formatClock(close)} (اعلام فروشنده)` : "امروز بسته شد (اعلام فروشنده)",
      openAfterArrival: Math.max(0, close - nowMin),
      closingSoon: open && close - nowMin <= 45,
      overrideNote: override.note,
    };
  }
  if (st.state === "unknown") return { state: "unknown", label: "ساعت کاری ثبت نشده", openAfterArrival: 0, closingSoon: false };
  if (st.state === "open") {
    const left = (st.closesAt - nowMin + 1440) % 1440;
    return {
      state: "open",
      label: st.closingSoon ? `${toFa(left)} دقیقه دیگر می‌بندد` : `باز تا ${formatClock(st.closesAt)}`,
      openAfterArrival: left,
      closingSoon: st.closingSoon,
    };
  }
  let label = "بسته";
  if (st.opensAt) {
    const when = st.opensAt.inDays === 0 ? "امروز" : st.opensAt.inDays === 1 ? "فردا" : DAY_LABEL[st.opensAt.day];
    label = `بسته، ${when} ساعت ${formatClock(st.opensAt.minutes)} باز می‌شود`;
  }
  return { state: "closed", label, openAfterArrival: 0, closingSoon: false };
}

const toFa = (n: number) => String(Math.round(n)).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);

function toWarranty(w: unknown): Warranty | null {
  if (!w || typeof w !== "object") return null;
  const o = w as { provider?: string | null; period_months?: number | null; description?: string | null };
  if (!o.provider && !o.period_months && !o.description) return null;
  return { provider: o.provider ?? null, months: o.period_months ?? null, description: o.description ?? null };
}

const SKIP_SPECS = new Set(["نام محصول", "شرکت سازنده", "تاریخ معرفی", "تاریخ انتشار"]);

export function keySpecs(specs: SpecRow[], n = 3) {
  return specs.filter((s) => !SKIP_SPECS.has(s.key) && s.value && s.value.length < 40).slice(0, n).map(({ key, value }) => ({ key, value }));
}

export async function getProduct(id: string): Promise<ProductDetail | null> {
  const [r] = await sql()<(Parameters<typeof toSummary>[0] & { model: string | null; specs: SpecRow[] })[]>`
    SELECT id, title, brand, model, category, images, specs, seller_count, price_min, price_median, price_max, last_change, 0 AS rank
    FROM products WHERE id = ${id}`;
  if (!r) return null;
  const specs = (r.specs ?? []).filter((s) => s && s.key && s.value);
  return { ...toSummary(r), model: r.model, images: r.images ?? [], specs, keySpecs: keySpecs(specs) };
}

export async function getProductsByIds(ids: string[]): Promise<ProductDetail[]> {
  if (!ids.length) return [];
  const rows = await sql()<(Parameters<typeof toSummary>[0] & { model: string | null; specs: SpecRow[] })[]>`
    SELECT id, title, brand, model, category, images, specs, seller_count, price_min, price_median, price_max, last_change, 0 AS rank
    FROM products WHERE id = ANY(${ids})`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => {
      const specs = (r.specs ?? []).filter((s) => s && s.key && s.value);
      return { ...toSummary(r), model: r.model, images: r.images ?? [], specs, keySpecs: keySpecs(specs) };
    });
}

export async function getShop(id: string): Promise<ShopSummary | null> {
  const [r] = await sql()<ShopRow[]>`SELECT ${shopCols()} FROM shops s WHERE s.id = ${id}`;
  return r ? toShop(r) : null;
}

async function latestConfirmations(productId: string, shopIds: string[]) {
  if (!shopIds.length) return new Map<string, Confirmation>();
  const rows = await sql()<{ shop_id: string; available: boolean; price: string | null; created_at: Date; source: "seller" | "crowd" }[]>`
    SELECT DISTINCT ON (shop_id) shop_id, available, price, created_at, source
    FROM confirmations
    WHERE product_id = ${productId} AND shop_id = ANY(${shopIds})
      AND created_at > now() - CASE WHEN source = 'seller' THEN interval '24 hours' ELSE interval '6 hours' END
    ORDER BY shop_id, created_at DESC`;
  return new Map(
    rows.map((r) => [
      r.shop_id,
      { available: r.available, price: r.price == null ? null : Number(r.price), at: new Date(r.created_at).toISOString(), source: r.source },
    ]),
  );
}

export async function todayOverrides(shopIds: string[]) {
  if (!shopIds.length) return new Map<string, { today_close: string | null; note: string | null }>();
  const rows = await sql()<{ shop_id: string; today_close: string | null; note: string | null }[]>`
    SELECT shop_id, today_close, note FROM shop_overrides
    WHERE shop_id = ANY(${shopIds}) AND today_date = (now() AT TIME ZONE 'Asia/Tehran')::date`;
  return new Map(rows.map((r) => [r.shop_id, r]));
}

async function recentCrowdClosed(shopIds: string[]) {
  if (!shopIds.length) return new Set<string>();
  const rows = await sql()<{ shop_id: string }[]>`
    SELECT DISTINCT shop_id FROM crowd_reports
    WHERE kind = 'closed' AND shop_id = ANY(${shopIds}) AND created_at > now() - interval '3 hours'`;
  return new Set(rows.map((r) => r.shop_id));
}

export interface OfferQuery {
  productId: string;
  origin: Origin;
  filters: Filters;
  now?: Date;
}

type OfferRow = ShopRow & {
  offer_id: string;
  seller_title: string;
  description: string | null;
  price: string | null;
  price_quality: "valid" | "missing" | "outlier";
  price_changed_at: Date | null;
  warranty: unknown;
};

/**
 * Every seller of a product, enriched with distance, arrival-time opening state,
 * freshness, confirmations and neighbours, ranked with explainable reasons.
 */
export async function shopsForProduct(q: OfferQuery): Promise<ShopsForProduct | null> {
  const now = q.now ?? new Date();
  const visitAt = q.filters.visitAt ? new Date(q.filters.visitAt) : null;
  const product = await getProduct(q.productId);
  if (!product) return null;
  const db = sql();
  const rows = await db<OfferRow[]>`
    SELECT ${shopCols()}, o.id AS offer_id, o.seller_title, o.description, o.price, o.price_quality,
           o.price_changed_at, o.warranty
    FROM offers o JOIN shops s ON s.id = o.shop_id
    WHERE o.product_id = ${q.productId}`;

  const stats = priceStats(rows.map((r) => (r.price == null ? NaN : Number(r.price))));
  const shopIds = rows.map((r) => r.id);
  const [confirms, overrides, crowdClosed] = await Promise.all([
    latestConfirmations(q.productId, shopIds),
    todayOverrides(shopIds),
    recentCrowdClosed(shopIds),
  ]);

  const build = (r: ShopRow, o: Partial<OfferRow> | null): ShopOffer => {
    const shop = toShop(r);
    const distanceM = haversine(q.origin, shop);
    const eta = estimateEta(q.origin, shop, q.filters.mode, now);
    const arrival = visitAt ?? new Date(now.getTime() + eta.minutes * 60_000);
    let open = openInfo(shop, arrival, overrides.get(shop.id));
    if (crowdClosed.has(shop.id)) open = { ...open, state: "closed", label: "کاربران گزارش دادند الان بسته است", openAfterArrival: 0 };
    const confirmation = confirms.get(shop.id) ?? null;
    const price = confirmation?.price ?? (o?.price == null ? null : Number(o.price));
    return {
      shop,
      offerId: o?.offer_id ?? null,
      sellerTitle: o?.seller_title ?? null,
      description: o?.description ?? null,
      price,
      priceQuality: o ? (o.price_quality as ShopOffer["priceQuality"]) : "none",
      priceChangedAt: o?.price_changed_at ? new Date(o.price_changed_at).toISOString() : null,
      freshness: freshnessOf(o?.price_changed_at ?? null, now, confirmation?.available === true),
      warranty: toWarranty(o?.warranty),
      listed: Boolean(o),
      confirmation,
      distanceM,
      etaMin: eta.minutes,
      open,
      neighbours: 0,
      hubId: null,
      suspicious: price != null && !confirmation ? isSuspicious(price, stats) : null,
      score: 0,
      reasons: [],
    };
  };

  // One card per shop: keep its cheapest valid listing (a shop may list several variants).
  const bestPerShop = new Map<string, OfferRow>();
  for (const r of rows) {
    const cur = bestPerShop.get(r.id);
    const p = r.price == null ? Infinity : Number(r.price);
    const cp = cur?.price == null ? Infinity : Number(cur.price);
    if (!cur || p < cp) bestPerShop.set(r.id, r);
  }
  let offers = [...bestPerShop.values()].map((r) => build(r, r));

  // Hubs: sellers of this product within a short walk of each other.
  const hubs = clusterCompact(
    offers.map((o) => ({ lat: o.shop.lat, lon: o.shop.lon, o })),
    180,
    (p) => p.o.shop.mallId,
  );
  const hubSummaries: HubSummary[] = [];
  hubs.forEach((h, i) => {
    const id = `hub_${i}`;
    h.members.forEach((m) => {
      m.o.neighbours = h.members.length - 1;
      m.o.hubId = h.members.length > 1 ? id : null;
    });
    if (h.members.length < 2) return;
    const os = h.members.map((m) => m.o);
    const prices = os.map((o) => o.price).filter((p): p is number => p != null);
    const mallCounts = new Map<string, number>();
    os.forEach((o) => o.shop.mallId && mallCounts.set(o.shop.mallId, (mallCounts.get(o.shop.mallId) ?? 0) + 1));
    const topMall = [...mallCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const mallName = topMall ? os.find((o) => o.shop.mallId === topMall[0])!.shop.mallName : null;
    const area = os[0]!.shop.area;
    const eta = estimateEta(q.origin, h.center, q.filters.mode, now);
    hubSummaries.push({
      id,
      label: mallName && topMall![1] >= Math.ceil(os.length / 2) ? mallName : `${toFa(os.length)} مغازه نزدیک هم در ${area ?? "این محدوده"}`,
      mallId: topMall?.[0] ?? null,
      lat: h.center.lat,
      lon: h.center.lon,
      sellerCount: os.length,
      openCount: os.filter((o) => o.open.state === "open").length,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      successChance: hubSuccessChance(
        os.map((o) => ({
          open: o.open.state !== "closed",
          trust: o.confirmation ? (o.confirmation.available ? 1 : 0) : freshnessScore(o.freshness) * (o.open.state === "unknown" ? 0.7 : 1),
        })),
      ),
      distanceM: haversine(q.origin, h.center),
      etaMin: eta.minutes,
      shopIds: os.map((o) => o.shop.id),
    });
  });

  offers = applyFilters(offers, q.filters);
  const ranked = rankCandidates(
    offers,
    (o) => ({
      price: o.price,
      distanceM: o.distanceM ?? 0,
      openState: o.open.state,
      openMinutesAfterArrival: o.open.openAfterArrival,
      freshness: o.freshness,
      neighbours: o.neighbours,
      hasWarranty: Boolean(o.warranty),
      hasInstallment: o.shop.payments.length > 0,
      listed: o.listed,
      sellerConfirmed: o.confirmation ? (o.confirmation.available ? "available" : "unavailable") : null,
    }),
    q.filters.priority,
  );
  offers = ranked.map((r) => ({ ...r.item, score: r.score, reasons: r.reasons }));

  // "Maybe" shops: same trade, no listing for this product, close to the user.
  const maybe = await categoryOnlyShops(product.category, q.origin, new Set(shopIds), 8);
  const maybeOffers = applyFilters(maybe.map((r) => build(r, null)), { ...q.filters, verifiedOnly: false, warranty: false }).map((o) => ({
    ...o,
    reasons: ["category_only" as const],
  }));

  // Prefer hubs that are likely to succeed, have many open sellers and are close.
  const hubValue = (h: HubSummary) => h.successChance * 2 + Math.min(h.openCount, 8) * 0.15 - (h.distanceM ?? 0) / 2500;
  hubSummaries.sort((a, b) => hubValue(b) - hubValue(a));

  const arrivalAt = (visitAt ?? new Date(now.getTime() + (offers[0]?.etaMin ?? 0) * 60_000)).toISOString();
  return {
    product,
    offers,
    maybe: maybeOffers,
    hubs: hubSummaries.slice(0, 5),
    stats,
    arrivalAt,
    trafficZone: offers.slice(0, 5).some((o) => inTrafficZone(o.shop)),
  };
}

export function applyFilters(offers: ShopOffer[], f: Filters): ShopOffer[] {
  return offers.filter((o) => {
    if (f.radiusKm != null && o.distanceM != null && o.distanceM > f.radiusKm * 1000) return false;
    if (f.maxPrice != null && o.price != null && o.price > f.maxPrice) return false;
    if (f.minPrice != null && o.price != null && o.price < f.minPrice) return false;
    if (f.openOnArrival && o.open.state === "closed") return false;
    if (f.installment && !o.shop.payments.length) return false;
    if (f.torobPayInPerson && !o.shop.payments.some((p) => p.providerKey === "torobpay" && p.channel === "in_person")) return false;
    if (f.warranty && !o.warranty) return false;
    if (f.fastDelivery && o.shop.fastDelivery !== true) return false;
    if (f.verifiedOnly && !o.confirmation?.available) return false;
    if (o.confirmation && !o.confirmation.available) return true; // keep, ranked last, shown as "ندارد"
    return true;
  });
}

export async function categoryOnlyShops(category: string, origin: LatLon, exclude: Set<string>, limit: number) {
  const b = bbox(origin, 6000);
  const rows = await sql()<(ShopRow & { d: number })[]>`
    SELECT ${shopCols()},
      ((s.lat - ${origin.lat})^2 + ((s.lon - ${origin.lon}) * cos(radians(${origin.lat})))^2) AS d
    FROM shops s
    WHERE ${category} = ANY(s.categories)
      AND s.lat BETWEEN ${b.minLat} AND ${b.maxLat} AND s.lon BETWEEN ${b.minLon} AND ${b.maxLon}
    ORDER BY d LIMIT ${limit + exclude.size}`;
  return rows.filter((r) => !exclude.has(r.id)).slice(0, limit);
}

/** Lightweight per-product "how many sellers near you" for result cards. */
export async function nearbySellerCounts(productIds: string[], origin: LatLon, radiusM = 3000) {
  if (!productIds.length) return new Map<string, { count: number; nearest: number }>();
  const b = bbox(origin, radiusM);
  const rows = await sql()<{ product_id: string; count: number; nearest: number }[]>`
    SELECT o.product_id, count(DISTINCT s.id)::int AS count,
      min(sqrt(((s.lat - ${origin.lat}) * 111320)^2 + ((s.lon - ${origin.lon}) * 111320 * cos(radians(${origin.lat})))^2))::int AS nearest
    FROM offers o JOIN shops s ON s.id = o.shop_id
    WHERE o.product_id = ANY(${productIds})
      AND s.lat BETWEEN ${b.minLat} AND ${b.maxLat} AND s.lon BETWEEN ${b.minLon} AND ${b.maxLon}
    GROUP BY o.product_id`;
  return new Map(rows.map((r) => [r.product_id, { count: r.count, nearest: r.nearest }]));
}

export async function withNearby<T extends ProductSummary>(items: T[], origin: Origin | null): Promise<T[]> {
  if (!origin) return items;
  const m = await nearbySellerCounts(items.map((i) => i.id), origin);
  return items.map((i) => ({ ...i, nearbySellers: m.get(i.id)?.count ?? 0, nearestM: m.get(i.id)?.nearest ?? null }));
}

/** Similar products: same category, overlapping brand/title tokens, ideally sold nearby. */
export async function similarProducts(productId: string, opts: { cheaperThan?: number | null; limit?: number } = {}) {
  const [p] = await sql()<{ category: string; title_norm: string; brand: string | null; price_median: string | null }[]>`
    SELECT category, title_norm, brand, price_median FROM products WHERE id = ${productId}`;
  if (!p) return [];
  const rows = await sql()<Parameters<typeof toSummary>[0][]>`
    SELECT id, title, brand, category, images, seller_count, price_min, price_median, price_max, last_change,
      similarity(title_norm, ${p.title_norm}) + CASE WHEN brand IS NOT DISTINCT FROM ${p.brand} THEN 0.2 ELSE 0 END
        + ln(1 + seller_count) * 0.15 AS rank
    FROM products
    WHERE category = ${p.category} AND id <> ${productId} AND seller_count > 0 AND price_min IS NOT NULL
      ${opts.cheaperThan ? sql()`AND price_min < ${opts.cheaperThan}` : sql()``}
    ORDER BY rank DESC LIMIT ${opts.limit ?? 6}`;
  return rows.map(toSummary);
}
