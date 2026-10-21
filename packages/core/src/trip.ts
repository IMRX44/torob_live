import { haversine, type LatLon } from "./geo";

export interface TripStopCandidate extends LatLon {
  shopId: string;
  /** item keys this shop can cover, with price */
  covers: Record<string, number | null>;
}

export interface TripPlan {
  stops: { shopId: string; items: string[]; lat: number; lon: number }[];
  uncovered: string[];
  totalMeters: number;
  totalPrice: number;
}

/**
 * Picks few, close stops that together cover every requested item (greedy set cover
 * weighted by distance), then orders them by nearest neighbour + 2-opt.
 */
export function planTrip(origin: LatLon, items: string[], candidates: TripStopCandidate[]): TripPlan {
  const remaining = new Set(items);
  const chosen: { c: TripStopCandidate; items: string[] }[] = [];
  let cursor: LatLon = origin;
  while (remaining.size) {
    let best: { c: TripStopCandidate; gain: string[]; cost: number } | null = null;
    for (const c of candidates) {
      if (chosen.some((x) => x.c.shopId === c.shopId)) continue;
      const gain = [...remaining].filter((it) => it in c.covers);
      if (!gain.length) continue;
      const d = haversine(cursor, c);
      const cost = (300 + d) / gain.length ** 1.6;
      if (!best || cost < best.cost) best = { c, gain, cost };
    }
    if (!best) break;
    chosen.push({ c: best.c, items: best.gain });
    best.gain.forEach((g) => remaining.delete(g));
    cursor = best.c;
  }
  const ordered = orderStops(origin, chosen.map((x) => x.c));
  const stops = ordered.map((c) => {
    const ch = chosen.find((x) => x.c.shopId === c.shopId)!;
    return { shopId: c.shopId, items: ch.items, lat: c.lat, lon: c.lon };
  });
  let totalMeters = 0;
  let prev: LatLon = origin;
  for (const s of stops) {
    totalMeters += haversine(prev, s);
    prev = s;
  }
  const totalPrice = chosen.reduce(
    (sum, x) => sum + x.items.reduce((s, it) => s + (x.c.covers[it] ?? 0), 0),
    0,
  );
  return { stops, uncovered: [...remaining], totalMeters, totalPrice };
}

function pathLen(origin: LatLon, pts: LatLon[]): number {
  let d = 0;
  let prev = origin;
  for (const p of pts) {
    d += haversine(prev, p);
    prev = p;
  }
  return d;
}

export function orderStops<T extends LatLon>(origin: LatLon, stops: T[]): T[] {
  const left = [...stops];
  const out: T[] = [];
  let cur: LatLon = origin;
  while (left.length) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) if (haversine(cur, left[i]!) < haversine(cur, left[bi]!)) bi = i;
    cur = left[bi]!;
    out.push(left.splice(bi, 1)[0]!);
  }
  // 2-opt improvement
  let improved = true;
  while (improved && out.length > 3) {
    improved = false;
    for (let i = 0; i < out.length - 1; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const cand = [...out.slice(0, i), ...out.slice(i, j + 1).reverse(), ...out.slice(j + 1)];
        if (pathLen(origin, cand) + 1 < pathLen(origin, out)) {
          out.splice(0, out.length, ...cand);
          improved = true;
        }
      }
    }
  }
  return out;
}

/** Visit order inside a mall: floor by floor, starting from the entrance level. */
export function mallVisitOrder<T extends { floor: number | null; unit: string | null }>(shops: T[]): T[] {
  const unitNum = (u: string | null) => Number((u ?? "").replace(/[^\d.]/g, "")) || 0;
  return [...shops].sort((a, b) => {
    const fa = a.floor ?? 0;
    const fb = b.floor ?? 0;
    const ka = fa < 0 ? 100 - fa : fa; // ground → up, basements last
    const kb = fb < 0 ? 100 - fb : fb;
    return ka - kb || unitNum(a.unit) - unitNum(b.unit);
  });
}
