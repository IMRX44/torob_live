export interface LatLon {
  lat: number;
  lon: number;
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in meters. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function centroid(points: LatLon[]): LatLon {
  const n = points.length || 1;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lon: points.reduce((s, p) => s + p.lon, 0) / n,
  };
}

/** Bounding box (degrees) around a point, for cheap SQL prefiltering. */
export function bbox(center: LatLon, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos(rad(center.lat)));
  return { minLat: center.lat - dLat, maxLat: center.lat + dLat, minLon: center.lon - dLon, maxLon: center.lon + dLon };
}

export interface Hub<T extends LatLon> {
  center: LatLon;
  members: T[];
  /** Longest walk from the center to a member, meters. */
  radius: number;
}

/**
 * Groups points that are within walking distance of each other (single-linkage,
 * `eps` meters). Used per query: "which places have several sellers of this item?".
 */
export function clusterByWalk<T extends LatLon>(points: T[], eps = 220): Hub<T>[] {
  const n = points.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (haversine(points[i]!, points[j]!) <= eps) parent[find(i)] = find(j);
    }
  }
  const groups = new Map<number, T[]>();
  points.forEach((p, i) => {
    const r = find(i);
    groups.set(r, [...(groups.get(r) ?? []), p]);
  });
  return [...groups.values()]
    .map((members) => {
      const center = centroid(members);
      return { center, members, radius: Math.max(0, ...members.map((m) => haversine(center, m))) };
    })
    .sort((a, b) => b.members.length - a.members.length);
}

/**
 * Compact hubs: points sharing a `group` key (e.g. the same mall) always stay together;
 * the rest join the nearest hub whose center is within `eps`, otherwise start a new one.
 * Unlike single-linkage this never chains a whole dense district into one blob.
 */
export function clusterCompact<T extends LatLon>(points: T[], eps = 180, group?: (p: T) => string | null): Hub<T>[] {
  const hubs: { key: string | null; members: T[]; center: LatLon }[] = [];
  const keyed = new Map<string, (typeof hubs)[number]>();
  for (const p of points) {
    const k = group?.(p) ?? null;
    if (k) {
      const h = keyed.get(k);
      if (h) {
        h.members.push(p);
        h.center = centroid(h.members);
      } else {
        const nh = { key: k, members: [p], center: { lat: p.lat, lon: p.lon } };
        keyed.set(k, nh);
        hubs.push(nh);
      }
    }
  }
  for (const p of points) {
    if (group?.(p)) continue;
    let best: (typeof hubs)[number] | null = null;
    let bestD = Infinity;
    for (const h of hubs) {
      const d = haversine(h.center, p);
      if (d < eps && d < bestD) {
        best = h;
        bestD = d;
      }
    }
    if (best) {
      best.members.push(p);
      if (!best.key) best.center = centroid(best.members);
    } else hubs.push({ key: null, members: [p], center: { lat: p.lat, lon: p.lon } });
  }
  return hubs
    .map((h) => ({ center: h.center, members: h.members, radius: Math.max(0, ...h.members.map((m) => haversine(h.center, m))) }))
    .sort((a, b) => b.members.length - a.members.length);
}
