import "server-only";
import { bbox, haversine, mallVisitOrder, type LatLon } from "@torob/core";
import { sql } from "./db";
import { openInfo, shopCols, todayOverrides, toShop, type ShopRow } from "./catalog";
import type { OpenInfo, ShopSummary } from "../types";

export interface MallSummary {
  id: string;
  name: string;
  area: string | null;
  lat: number;
  lon: number;
  shopCount: number;
  floors: number[];
  topCategories: string[];
  distanceM?: number;
}

type MallRow = { id: string; name: string; area: string | null; lat: number; lon: number; shop_count: number; floors: number[]; top_categories: string[] };
const toMall = (r: MallRow): MallSummary => ({
  id: r.id,
  name: r.name,
  area: r.area,
  lat: r.lat,
  lon: r.lon,
  shopCount: r.shop_count,
  floors: r.floors,
  topCategories: r.top_categories,
});

export interface MallDetail extends MallSummary {
  shops: (ShopSummary & { open: OpenInfo; productHint?: { price: number | null; title: string } | null })[];
}

/** A mall with its shops in walking order, optionally highlighting sellers of one product. */
export async function getMall(id: string, opts: { productId?: string | null; now?: Date } = {}): Promise<MallDetail | null> {
  const db = sql();
  const [m] = await db<MallRow[]>`SELECT * FROM malls WHERE id = ${id}`;
  if (!m) return null;
  const rows = await db<ShopRow[]>`SELECT ${shopCols()} FROM shops s WHERE s.mall_id = ${id}`;
  const hints = new Map<string, { price: number | null; title: string }>();
  if (opts.productId) {
    const offers = await db<{ shop_id: string; price: string | null; seller_title: string }[]>`
      SELECT o.shop_id, o.price, o.seller_title FROM offers o JOIN shops s ON s.id = o.shop_id
      WHERE s.mall_id = ${id} AND o.product_id = ${opts.productId}`;
    offers.forEach((o) => hints.set(o.shop_id, { price: o.price == null ? null : Number(o.price), title: o.seller_title }));
  }
  const now = opts.now ?? new Date();
  const overrides = await todayOverrides(rows.map((r) => r.id));
  const shops = mallVisitOrder(
    rows.map((r) => {
      const s = toShop(r);
      return { ...s, open: openInfo(s, now, overrides.get(s.id)), productHint: hints.get(s.id) ?? null };
    }),
  );
  return { ...toMall(m), shops };
}

export async function mallsNear(origin: LatLon, radiusM = 4000, limit = 12): Promise<MallSummary[]> {
  const b = bbox(origin, radiusM);
  const rows = await sql()<MallRow[]>`
    SELECT * FROM malls WHERE lat BETWEEN ${b.minLat} AND ${b.maxLat} AND lon BETWEEN ${b.minLon} AND ${b.maxLon}
    ORDER BY shop_count DESC LIMIT 60`;
  return rows
    .map((r) => ({ ...toMall(r), distanceM: haversine(origin, r) }))
    .sort((a, b) => b.shopCount / (1 + a.distanceM! / 800) - a.shopCount / (1 + b.distanceM! / 800))
    .slice(0, limit);
}

export async function topMalls(limit = 8): Promise<MallSummary[]> {
  return (await sql()<MallRow[]>`SELECT * FROM malls ORDER BY shop_count DESC LIMIT ${limit}`).map(toMall);
}
