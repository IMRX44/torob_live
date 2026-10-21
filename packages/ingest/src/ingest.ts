import type { Sql } from "@torob/db";
import {
  centroid,
  haversine,
  normalizeFa,
  parseAddress,
  parsePayments,
  parseWeeklyHours,
  priceQuality,
  priceStats,
  type PriceQuality,
} from "@torob/core";
import { readCsv } from "./archive";

interface ShopRow {
  id: string;
  name: string;
  name_is_real: boolean;
  address: string;
  area: string | null;
  lat: number;
  lon: number;
  categories: string[];
  categories_norm: string;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  fast_delivery: boolean | null;
  hours: unknown;
  hours_known: boolean;
  payments: unknown;
  has_installment: boolean;
  has_torobpay_in_person: boolean;
  mall_id: string | null;
  mall_name: string | null;
  floor: number | null;
  unit: string | null;
  offer_count: number;
  _mallKey: string | null;
}

const json = <T>(s: string | null, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

async function insertBatches(sql: Sql, table: string, rows: Record<string, unknown>[], size = 2000) {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    await sql`INSERT INTO ${sql(table)} ${sql(chunk as never)}`;
  }
}

export async function ingest(sql: Sql, zipPath: string, log = console.log) {
  const t0 = Date.now();
  const report: Record<string, unknown> = {};

  // ── shops ────────────────────────────────────────────────────────────────
  const shops: ShopRow[] = [];
  for await (const r of readCsv(zipPath, "shops.csv")) {
    const addr = parseAddress(r.address);
    const hours = parseWeeklyHours(r.weekly_hours);
    const payments = parsePayments(r.payment_options);
    const contacts = json<{ channel: string; display_number?: string }[]>(r.contacts, []);
    const insta = json<{ profile_url?: string } | null>(r.instagram, null);
    const categories = json<string[]>(r.category_names, []);
    shops.push({
      id: r.shop_id!,
      name: r.name ?? "فروشگاه",
      name_is_real: Boolean(r.instagram || r.website_url),
      address: r.address ?? "",
      area: r.location_label,
      lat: Number(r.lat),
      lon: Number(r.lon),
      categories,
      categories_norm: normalizeFa(categories.join(" | ")),
      phone: contacts.find((c) => c.channel === "phone")?.display_number ?? null,
      instagram: insta?.profile_url ?? null,
      website: r.website_url,
      fast_delivery: r.supports_fast_delivery == null ? null : r.supports_fast_delivery === "true",
      hours: json(r.weekly_hours, {}),
      hours_known: hours.known,
      payments,
      has_installment: payments.some((p) => p.installment),
      has_torobpay_in_person: payments.some((p) => p.providerKey === "torobpay" && p.channel === "in_person"),
      mall_id: null,
      mall_name: addr.mallName,
      floor: addr.floor,
      unit: addr.unit,
      offer_count: 0,
      _mallKey: addr.mallKey,
    });
  }
  log(`shops parsed: ${shops.length}`);

  // ── malls: same normalized name AND within walking distance ─────────────
  const byKey = new Map<string, ShopRow[]>();
  for (const s of shops) if (s._mallKey) byKey.set(s._mallKey, [...(byKey.get(s._mallKey) ?? []), s]);
  const malls: Record<string, unknown>[] = [];
  let mallSeq = 0;
  for (const [key, group] of byKey) {
    const clusters: ShopRow[][] = [];
    for (const s of group) {
      const c = clusters.find((cl) => haversine(centroid(cl), s) < 450);
      if (c) c.push(s);
      else clusters.push([s]);
    }
    for (const cl of clusters) {
      if (cl.length < 2) continue;
      const id = `mall_${++mallSeq}`;
      const names = new Map<string, number>();
      cl.forEach((s) => names.set(s.mall_name!, (names.get(s.mall_name!) ?? 0) + 1));
      const name = [...names.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      const cats = new Map<string, number>();
      cl.forEach((s) => s.categories.slice(0, 6).forEach((c) => cats.set(c, (cats.get(c) ?? 0) + 1)));
      const center = centroid(cl);
      const areas = new Map<string, number>();
      cl.forEach((s) => s.area && areas.set(s.area, (areas.get(s.area) ?? 0) + 1));
      malls.push({
        id,
        name,
        area: [...areas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        lat: center.lat,
        lon: center.lon,
        shop_count: cl.length,
        floors: [...new Set(cl.map((s) => s.floor).filter((f): f is number => f != null))].sort((a, b) => a - b),
        top_categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]),
      });
      cl.forEach((s) => (s.mall_id = id));
      void key;
    }
  }
  log(`malls built: ${malls.length}`);

  // ── products ─────────────────────────────────────────────────────────────
  const products = new Map<string, Record<string, unknown>>();
  for await (const r of readCsv(zipPath, "products.csv")) {
    const title = r.persian_title ?? "";
    products.set(r.product_id!, {
      id: r.product_id!,
      title,
      title_norm: normalizeFa([title, r.brand_name, r.model].filter(Boolean).join(" ")),
      brand: r.brand_name,
      model: r.model,
      category: r.category_name ?? "سایر",
      images: json<string[]>(r.image_urls, []).slice(0, 6),
      specs: json(r.specs, []),
      seller_count: 0,
      price_min: null,
      price_median: null,
      price_max: null,
      last_change: null,
    });
  }
  log(`products parsed: ${products.size}`);

  // ── offers ───────────────────────────────────────────────────────────────
  const offers: Record<string, unknown>[] = [];
  const pricesByProduct = new Map<string, number[]>();
  const sellers = new Map<string, Set<string>>();
  const lastChange = new Map<string, string>();
  const shopIndex = new Map(shops.map((s) => [s.id, s]));
  const quality: Record<PriceQuality, number> = { valid: 0, missing: 0, outlier: 0 };
  let warrantyCount = 0;
  for await (const r of readCsv(zipPath, "offers.csv")) {
    if (!products.has(r.product_id!) || !shopIndex.has(r.shop_id!)) continue;
    const price = r.price_toman == null ? null : Number(r.price_toman);
    const q = priceQuality(price);
    quality[q]++;
    const warranty = json<Record<string, unknown> | null>(r.warranty, null);
    if (warranty) warrantyCount++;
    offers.push({
      id: r.offer_id!,
      product_id: r.product_id!,
      shop_id: r.shop_id!,
      seller_title: r.seller_title ?? "",
      description: r.description,
      price: q === "outlier" ? null : price,
      price_quality: q,
      price_changed_at: r.last_price_changed_at,
      warranty,
    });
    if (q === "valid") pricesByProduct.set(r.product_id!, [...(pricesByProduct.get(r.product_id!) ?? []), price!]);
    if (!sellers.has(r.product_id!)) sellers.set(r.product_id!, new Set());
    sellers.get(r.product_id!)!.add(r.shop_id!);
    if (r.last_price_changed_at && (lastChange.get(r.product_id!) ?? "") < r.last_price_changed_at) {
      lastChange.set(r.product_id!, r.last_price_changed_at);
    }
    shopIndex.get(r.shop_id!)!.offer_count++;
  }
  log(`offers parsed: ${offers.length}`);

  for (const [id, p] of products) {
    const st = priceStats(pricesByProduct.get(id) ?? []);
    p.seller_count = sellers.get(id)?.size ?? 0;
    p.price_min = st?.min ?? null;
    p.price_median = st ? Math.round(st.median) : null;
    p.price_max = st?.max ?? null;
    p.last_change = lastChange.get(id) ?? null;
  }

  // ── categories ───────────────────────────────────────────────────────────
  const cat = new Map<string, { p: number; o: number; s: Set<string> }>();
  for (const p of products.values()) {
    const c = cat.get(p.category as string) ?? { p: 0, o: 0, s: new Set<string>() };
    c.p++;
    cat.set(p.category as string, c);
  }
  for (const o of offers) {
    const c = cat.get(products.get(o.product_id as string)!.category as string)!;
    c.o++;
    c.s.add(o.shop_id as string);
  }

  // ── load ─────────────────────────────────────────────────────────────────
  await sql.begin(async (tx) => {
    await tx`TRUNCATE offers, products, shops, malls, categories, dataset_report`;
    await insertBatches(tx as unknown as Sql, "malls", malls);
    await insertBatches(
      tx as unknown as Sql,
      "shops",
      shops.map(({ _mallKey, ...s }) => ({ ...s, hours: tx.json(s.hours as never), payments: tx.json(s.payments as never) })),
    );
    await insertBatches(
      tx as unknown as Sql,
      "products",
      [...products.values()].map((p) => ({ ...p, specs: tx.json(p.specs as never) })),
      1000,
    );
    await insertBatches(
      tx as unknown as Sql,
      "offers",
      offers.map((o) => ({ ...o, warranty: o.warranty ? tx.json(o.warranty as never) : null })),
    );
    await insertBatches(
      tx as unknown as Sql,
      "categories",
      [...cat.entries()].map(([name, c]) => ({
        name,
        name_norm: normalizeFa(name),
        product_count: c.p,
        offer_count: c.o,
        shop_count: c.s.size,
      })),
    );

    const multi = [...sellers.values()].filter((s) => s.size >= 2).length;
    const dates = offers.map((o) => o.price_changed_at as string | null).filter(Boolean).sort() as string[];
    Object.assign(report, {
      generatedAt: new Date().toISOString(),
      shops: {
        total: shops.length,
        withOffers: shops.filter((s) => s.offer_count > 0).length,
        categoryOnly: shops.filter((s) => s.offer_count === 0).length,
        realNames: shops.filter((s) => s.name_is_real).length,
        hoursKnown: shops.filter((s) => s.hours_known).length,
        withPayments: shops.filter((s) => s.has_installment).length,
        torobPayInPerson: shops.filter((s) => s.has_torobpay_in_person).length,
        fastDelivery: {
          yes: shops.filter((s) => s.fast_delivery === true).length,
          no: shops.filter((s) => s.fast_delivery === false).length,
          unknown: shops.filter((s) => s.fast_delivery == null).length,
        },
        inMall: shops.filter((s) => s.mall_name).length,
        withFloor: shops.filter((s) => s.floor != null).length,
        withUnit: shops.filter((s) => s.unit).length,
        topAreas: Object.entries(
          shops.reduce<Record<string, number>>((m, s) => ((m[s.area ?? "?"] = (m[s.area ?? "?"] ?? 0) + 1), m), {}),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8),
      },
      malls: { total: malls.length },
      products: {
        total: products.size,
        withSpecs: [...products.values()].filter((p) => (p.specs as unknown[]).length > 0).length,
        withBrand: [...products.values()].filter((p) => p.brand).length,
        multiSeller: multi,
        categories: cat.size,
      },
      offers: {
        total: offers.length,
        priceQuality: quality,
        withWarranty: warrantyCount,
        oldestChange: dates[0] ?? null,
        newestChange: dates[dates.length - 1] ?? null,
      },
    });
    await tx`INSERT INTO dataset_report (id, report) VALUES (1, ${tx.json(report as never)})`;
  });
  await sql`ANALYZE`;
  log(`ingest finished in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return report;
}
