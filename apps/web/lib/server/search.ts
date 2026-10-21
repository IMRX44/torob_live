import "server-only";
import { normalizeFa, bbox, type LatLon } from "@torob/core";
import { sql } from "./db";
import type { ProductSummary } from "../types";

/** Shopper vocabulary → catalog vocabulary. */
const SYNONYMS: Record<string, string[]> = {
  هندزفری: ["هندزفری", "هدفون", "هدست", "ایرپاد", "ایربادز"],
  هدفون: ["هدفون", "هندزفری", "هدست"],
  ایرپاد: ["ایرپاد", "airpods", "هندزفری"],
  گوشی: ["گوشی", "موبایل"],
  موبایل: ["موبایل", "گوشی"],
  آیفون: ["آیفون", "iphone", "اپل"],
  iphone: ["iphone", "آیفون"],
  سامسونگ: ["سامسونگ", "samsung", "گلکسی"],
  شیائومی: ["شیائومی", "xiaomi", "ردمی", "پوکو"],
  لپتاپ: ["لپ تاپ", "لپتاپ", "notebook"],
  لپ: ["لپ تاپ"],
  شارژر: ["شارژر", "آداپتور", "کلگی"],
  کابل: ["کابل", "سیم"],
  پاوربانک: ["پاوربانک", "پاور بانک", "شارژر همراه"],
  لامپ: ["لامپ", "چراغ"],
  چراغ: ["چراغ", "لامپ", "پنل"],
  دوربین: ["دوربین"],
  مداربسته: ["مداربسته", "مدار بسته", "نظارتی"],
  ساعت: ["ساعت"],
  اسپیکر: ["اسپیکر", "بلندگو"],
  بلوتوثی: ["بلوتوث", "بی سیم", "wireless"],
  بیسیم: ["بی سیم", "بلوتوث", "wireless"],
  کتونی: ["کتانی", "کفش ورزشی", "اسنیکر"],
  کفش: ["کفش", "کتانی"],
  عطر: ["عطر", "ادکلن", "ادو"],
  پریز: ["پریز"],
  کلید: ["کلید"],
  تلویزیون: ["تلویزیون", "tv"],
  یخچال: ["یخچال"],
  جاروبرقی: ["جارو برقی", "جاروبرقی"],
  مانیتور: ["مانیتور"],
  کیبورد: ["کیبورد", "صفحه کلید"],
  ماوس: ["ماوس", "موس"],
  موس: ["ماوس", "موس"],
};

/** Strips Persian suffixes so "بلوتوثی"/"گوشی‌ها" still match. */
function stem(t: string): string {
  if (/^[a-z0-9.]+$/.test(t)) return t;
  return t.replace(/(?:های|ها|ترین|تر)$/, "").replace(/(?<=..)ی$/, "") || t;
}

export function expandQuery(q: string): string[][] {
  return normalizeFa(q)
    .split(" ")
    .filter((t) => t.length > 1)
    .slice(0, 6)
    .map((t) => {
      const syn = SYNONYMS[t] ?? SYNONYMS[stem(t)] ?? [];
      return [...new Set([stem(t), ...syn.map((s) => normalizeFa(s))])];
    });
}

export interface SearchParams {
  q: string;
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  near?: (LatLon & { radiusM: number }) | null;
  limit?: number;
  requireOffers?: boolean;
  installment?: boolean;
}

type Row = {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  images: string[];
  seller_count: number;
  price_min: string | null;
  price_median: string | null;
  price_max: string | null;
  last_change: Date | null;
  rank: number;
};

export function toSummary(r: Row): ProductSummary {
  return {
    id: r.id,
    title: r.title,
    brand: r.brand,
    category: r.category,
    image: r.images?.[0] ?? null,
    sellerCount: r.seller_count,
    priceMin: r.price_min == null ? null : Number(r.price_min),
    priceMedian: r.price_median == null ? null : Number(r.price_median),
    priceMax: r.price_max == null ? null : Number(r.price_max),
    lastChange: r.last_change ? new Date(r.last_change).toISOString() : null,
  };
}

/**
 * Lexical search with synonym groups: every token group must match (AND of ORs),
 * then rank by trigram similarity, seller count and price availability.
 * Falls back to fuzzy trigram matching when the strict pass finds nothing.
 */
export async function searchProducts(p: SearchParams): Promise<ProductSummary[]> {
  const db = sql();
  const groups = expandQuery(p.q);
  const qn = normalizeFa(p.q);
  const limit = Math.min(p.limit ?? 24, 60);
  if (!groups.length && !p.category) return [];

  const priceCond = db`
    ${p.maxPrice != null ? db`AND (pr.price_min IS NOT NULL AND pr.price_min <= ${p.maxPrice})` : db``}
    ${p.minPrice != null ? db`AND (pr.price_max IS NOT NULL AND pr.price_max >= ${p.minPrice})` : db``}
    ${p.category ? db`AND pr.category = ${p.category}` : db``}
    ${p.requireOffers !== false ? db`AND pr.seller_count > 0` : db``}
    ${p.installment ? db`AND EXISTS (SELECT 1 FROM offers oi JOIN shops si ON si.id = oi.shop_id WHERE oi.product_id = pr.id AND si.has_installment)` : db``}`;

  let nearCond = db``;
  if (p.near) {
    const b = bbox(p.near, p.near.radiusM);
    nearCond = db`AND EXISTS (
      SELECT 1 FROM offers o JOIN shops s ON s.id = o.shop_id
      WHERE o.product_id = pr.id
        AND s.lat BETWEEN ${b.minLat} AND ${b.maxLat} AND s.lon BETWEEN ${b.minLon} AND ${b.maxLon})`;
  }

  // Boost products whose category itself matches the query ("لپ تاپ" → laptops, not laptop bags).
  const catRows = qn
    ? await db<{ name: string }[]>`
        SELECT name FROM categories
        WHERE name_norm ILIKE ${"%" + qn + "%"} OR (${qn} <% name_norm AND word_similarity(${qn}, name_norm) > 0.6)
        ORDER BY (name_norm ILIKE ${qn + "%"}) DESC, offer_count DESC LIMIT 3`
    : [];
  const boostCats = catRows.map((c) => c.name);

  const tokenCond = groups.length
    ? groups.map((g) => db`AND pr.title_norm ILIKE ANY(${g.map((t) => `%${t}%`)}::text[])`)
    : [];

  const strict = await db<Row[]>`
    SELECT pr.id, pr.title, pr.brand, pr.category, pr.images, pr.seller_count,
           pr.price_min, pr.price_median, pr.price_max, pr.last_change,
           (similarity(pr.title_norm, ${qn}) * 3
             + CASE WHEN pr.category = ANY(${boostCats}::text[]) THEN 1.6 ELSE 0 END
             + ln(1 + pr.seller_count) * 0.6
             + CASE WHEN pr.price_min IS NOT NULL THEN 0.4 ELSE 0 END
             + CASE WHEN pr.last_change > now() - interval '30 days' THEN 0.3 ELSE 0 END) AS rank
    FROM products pr
    WHERE TRUE ${tokenCond} ${priceCond} ${nearCond}
    ORDER BY rank DESC
    LIMIT ${limit}`;
  if (strict.length || !qn) return strict.map(toSummary);

  // Fuzzy fallback for typos: word similarity on the whole query.
  const fuzzy = await db<Row[]>`
    SELECT pr.id, pr.title, pr.brand, pr.category, pr.images, pr.seller_count,
           pr.price_min, pr.price_median, pr.price_max, pr.last_change,
           word_similarity(${qn}, pr.title_norm) * 3 + ln(1 + pr.seller_count) * 0.4 AS rank
    FROM products pr
    WHERE ${qn} <% pr.title_norm ${priceCond} ${nearCond}
    ORDER BY rank DESC
    LIMIT ${limit}`;
  return fuzzy.map(toSummary);
}

/** Categories matching a query, used for "did you mean" chips and category-only shops. */
export async function matchCategories(q: string, limit = 5) {
  const qn = normalizeFa(q);
  if (!qn) return [];
  return sql()<{ name: string; product_count: number; shop_count: number }[]>`
    SELECT name, product_count, shop_count FROM categories
    WHERE name_norm % ${qn} OR name_norm ILIKE ${"%" + qn + "%"}
    ORDER BY similarity(name_norm, ${qn}) DESC, offer_count DESC
    LIMIT ${limit}`;
}

/** Facets over a result set: categories and brands with counts. */
export function facets(items: ProductSummary[]) {
  const cat = new Map<string, number>();
  const brand = new Map<string, number>();
  for (const i of items) {
    cat.set(i.category, (cat.get(i.category) ?? 0) + 1);
    if (i.brand) brand.set(i.brand, (brand.get(i.brand) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { categories: top(cat), brands: top(brand) };
}
