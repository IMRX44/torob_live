import "server-only";
import { bbox, estimateEta, haversine, inTrafficZone, planTrip, type TripStopCandidate } from "@torob/core";
import { sql } from "./db";
import { openInfo, shopCols, todayOverrides, toShop, type ShopRow } from "./catalog";
import { searchProducts } from "./search";
import type { OpenInfo, Origin, ShopSummary } from "../types";

export interface TripItemInput {
  label: string;
  productId?: string | null;
}

export interface TripStop {
  shop: ShopSummary;
  items: { label: string; productId: string; title: string; price: number | null }[];
  arriveAt: string;
  leaveAt: string;
  travelMin: number;
  travelMode: "walk" | "car" | "metro";
  open: OpenInfo;
  warning: string | null;
}

export interface TripResult {
  origin: Origin;
  stops: TripStop[];
  uncovered: string[];
  totalPrice: number;
  totalMeters: number;
  totalMinutes: number;
  trafficZone: boolean;
  startAt: string;
  endAt: string;
}

const DWELL_MIN = 12;

export async function buildTrip(origin: Origin, items: TripItemInput[], opts: { start?: Date; radiusM?: number } = {}): Promise<TripResult> {
  const start = opts.start ?? new Date();
  const b = bbox(origin, opts.radiusM ?? 9000);
  const db = sql();

  // Resolve each item to a few candidate products.
  const resolved = await Promise.all(
    items.map(async (it) => {
      if (it.productId) return { label: it.label, productIds: [it.productId] };
      const found = await searchProducts({ q: it.label, limit: 6 });
      return { label: it.label, productIds: found.map((f) => f.id) };
    }),
  );
  const allIds = [...new Set(resolved.flatMap((r) => r.productIds))];
  const rows = allIds.length
    ? await db<(ShopRow & { product_id: string; price: string | null; title: string })[]>`
        SELECT ${shopCols()}, o.product_id, o.price, p.title
        FROM offers o JOIN shops s ON s.id = o.shop_id JOIN products p ON p.id = o.product_id
        WHERE o.product_id = ANY(${allIds})
          AND s.lat BETWEEN ${b.minLat} AND ${b.maxLat} AND s.lon BETWEEN ${b.minLon} AND ${b.maxLon}`
    : [];

  const shops = new Map<string, ShopSummary>();
  const covers = new Map<string, Record<string, { price: number | null; productId: string; title: string }>>();
  for (const r of rows) {
    if (!shops.has(r.id)) shops.set(r.id, toShop(r));
    const it = resolved.find((x) => x.productIds.includes(r.product_id));
    if (!it) continue;
    const c = covers.get(r.id) ?? {};
    const price = r.price == null ? null : Number(r.price);
    const prev = c[it.label];
    if (!prev || (price != null && (prev.price == null || price < prev.price))) {
      c[it.label] = { price, productId: r.product_id, title: r.title };
    }
    covers.set(r.id, c);
  }

  const overrides = await todayOverrides([...shops.keys()]);
  const candidates: TripStopCandidate[] = [];
  for (const [id, shop] of shops) {
    // Skip shops that are certainly closed on arrival.
    const eta = estimateEta(origin, shop, "car", start);
    const st = openInfo(shop, new Date(start.getTime() + eta.minutes * 60_000), overrides.get(id));
    if (st.state === "closed") continue;
    const c = covers.get(id)!;
    candidates.push({
      shopId: id,
      lat: shop.lat,
      lon: shop.lon,
      covers: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.price])),
    });
  }

  const plan = planTrip(origin, resolved.map((r) => r.label), candidates);

  const stops: TripStop[] = [];
  let clock = start;
  let prev: { lat: number; lon: number } = origin;
  for (const s of plan.stops) {
    const shop = shops.get(s.shopId)!;
    const mode = haversine(prev, shop) < 1300 ? "walk" : "car";
    const eta = estimateEta(prev, shop, mode, clock);
    const arrive = new Date(clock.getTime() + eta.minutes * 60_000);
    const open = openInfo(shop, arrive, overrides.get(shop.id));
    const leave = new Date(arrive.getTime() + DWELL_MIN * 60_000);
    let warning: string | null = null;
    if (open.state === "open" && open.openAfterArrival < DWELL_MIN + 10) warning = "نزدیک ساعت بسته شدن می‌رسید";
    if (open.state === "unknown") warning = "ساعت کاری ثبت نشده؛ قبل از رفتن استعلام بگیرید";
    const c = covers.get(shop.id)!;
    stops.push({
      shop,
      items: s.items.map((label) => ({ label, productId: c[label]!.productId, title: c[label]!.title, price: c[label]!.price })),
      arriveAt: arrive.toISOString(),
      leaveAt: leave.toISOString(),
      travelMin: eta.minutes,
      travelMode: mode,
      open,
      warning,
    });
    clock = leave;
    prev = shop;
  }

  return {
    origin,
    stops,
    uncovered: plan.uncovered,
    totalPrice: stops.reduce((sum, s) => sum + s.items.reduce((a, i) => a + (i.price ?? 0), 0), 0),
    totalMeters: plan.totalMeters,
    totalMinutes: (clock.getTime() - start.getTime()) / 60_000,
    trafficZone: stops.some((s) => inTrafficZone(s.shop)),
    startAt: start.toISOString(),
    endAt: clock.toISOString(),
  };
}
