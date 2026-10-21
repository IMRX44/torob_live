import { haversine, type LatLon } from "./geo";
import { tehranClock } from "./hours";

export type TravelMode = "walk" | "car" | "metro";

export interface Eta {
  mode: TravelMode;
  minutes: number;
  meters: number;
}

/** Street distance is longer than the straight line. */
const DETOUR = 1.35;

/** Average Tehran driving speed (km/h) by hour; peak hours crawl. */
function carSpeed(hour: number): number {
  if ((hour >= 7 && hour < 10) || (hour >= 16 && hour < 20)) return 13;
  if (hour >= 10 && hour < 16) return 18;
  return 26;
}

/** Heuristic ETA; swapped for a routing API when one is configured. */
export function estimateEta(from: LatLon, to: LatLon, mode: TravelMode, at = new Date()): Eta {
  const meters = haversine(from, to) * DETOUR;
  const km = meters / 1000;
  let minutes: number;
  if (mode === "walk") minutes = (km / 4.6) * 60;
  else if (mode === "car") minutes = (km / carSpeed(Math.floor(tehranClock(at).minutes / 60))) * 60 + 6; // + parking
  else minutes = (km / 24) * 60 + 12; // metro: average incl. walking to/from stations
  return { mode, minutes: Math.max(1, minutes), meters };
}

/** The sensible default mode for a trip of this length. */
export function suggestMode(from: LatLon, to: LatLon): TravelMode {
  const m = haversine(from, to);
  if (m < 1300) return "walk";
  return "car";
}

/**
 * Central Tehran traffic-plan zone (approximate polygon around the downtown bazaar/Laleh-zar
 * district). Driving in requires a permit, so we suggest metro instead.
 */
export const TRAFFIC_ZONE: LatLon[] = [
  { lat: 35.7215, lon: 51.3735 },
  { lat: 35.7215, lon: 51.4505 },
  { lat: 35.6655, lon: 51.4505 },
  { lat: 35.6655, lon: 51.3735 },
];

export function inPolygon(p: LatLon, poly: LatLon[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.lon > p.lon !== b.lon > p.lon && p.lat < ((b.lat - a.lat) * (p.lon - a.lon)) / (b.lon - a.lon) + a.lat) {
      inside = !inside;
    }
  }
  return inside;
}

export function inTrafficZone(p: LatLon): boolean {
  return inPolygon(p, TRAFFIC_ZONE);
}
