import { DEFAULT_ORIGIN } from "./places";
import { DEFAULT_FILTERS, type Filters, type Origin } from "./types";

type Getter = { get(name: string): string | null };

/** Inverse of `contextParams`, used by route handlers and server pages. */
export function parseContext(p: Getter): { origin: Origin; filters: Filters } {
  const lat = Number(p.get("lat"));
  const lon = Number(p.get("lon"));
  const valid = Number.isFinite(lat) && Number.isFinite(lon) && lat > 35 && lat < 36.2 && lon > 50.8 && lon < 52;
  const origin: Origin = valid ? { lat, lon, label: p.get("ol") ?? "موقعیت شما", source: "map" } : DEFAULT_ORIGIN;
  const num = (k: string) => {
    const v = p.get(k);
    return v == null || v === "" ? null : Number(v);
  };
  const bool = (k: string) => p.get(k) === "true";
  const pr = p.get("priority");
  const mode = p.get("mode");
  const filters: Filters = {
    ...DEFAULT_FILTERS,
    radiusKm: num("radiusKm"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    openOnArrival: bool("openOnArrival"),
    installment: bool("installment"),
    torobPayInPerson: bool("torobPayInPerson"),
    warranty: bool("warranty"),
    fastDelivery: bool("fastDelivery"),
    verifiedOnly: bool("verifiedOnly"),
    priority: pr === "cheapest" || pr === "nearest" || pr === "surest" ? pr : "balanced",
    mode: mode === "walk" || mode === "metro" ? mode : "car",
    visitAt: validVisit(p.get("visitAt")),
  };
  return { origin, filters };
}

/** Accept a planned visit only within the next week (stale stored values fall back to "now"). */
function validVisit(v: string | null): string | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return null;
  const now = Date.now();
  return t > now - 30 * 60_000 && t < now + 7 * 86_400_000 ? new Date(t).toISOString() : null;
}

export function toGetter(sp: Record<string, string | string[] | undefined>): Getter {
  return { get: (k) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0]! : ((sp[k] as string | undefined) ?? null)) };
}
