import type { NextRequest } from "next/server";
import { parseIntent } from "@/lib/agent/intent";
import { parseContext } from "@/lib/context-parse";
import { searchProducts, facets, matchCategories } from "@/lib/server/search";
import { withNearby } from "@/lib/server/catalog";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Instant product search: rule-based intent + catalog search + nearby seller counts. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const raw = sp.get("q") ?? "";
  const { origin, filters } = parseContext(sp);
  const intent = parseIntent(raw);
  const f = { ...filters, ...intent.filters };
  const o = intent.place ? { ...intent.place, label: intent.place.name, source: "preset" as const } : origin;
  const near = f.radiusKm ? { lat: o.lat, lon: o.lon, radiusM: f.radiusKm * 1000 } : null;
  const base = { q: intent.query || raw, minPrice: f.minPrice, maxPrice: f.maxPrice, near, category: sp.get("category"), limit: 24 };
  const [first, cats] = await Promise.all([
    searchProducts({ ...base, installment: f.installment }),
    matchCategories(intent.query || raw, 4),
  ]);
  // Never dead-end: relax constraints one by one and say which one we relaxed.
  let items = first;
  const relaxed: string[] = [];
  if (!items.length && f.installment) {
    items = await searchProducts(base);
    if (items.length) relaxed.push("installment");
  }
  if (!items.length && near) {
    items = await searchProducts({ ...base, near: null });
    if (items.length) relaxed.push("radius");
  }
  if (!items.length && (f.maxPrice != null || f.minPrice != null)) {
    items = await searchProducts({ ...base, near: null, minPrice: null, maxPrice: null });
    if (items.length) relaxed.push("budget");
  }
  const enriched = await withNearby(items, o);
  return json({ intent, origin: o, filters: f, relaxed, items: enriched, facets: facets(items), categories: cats });
}
