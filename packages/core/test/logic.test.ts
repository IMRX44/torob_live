import { describe, expect, it } from "vitest";
import { priceQuality, priceStats, isSuspicious, freshnessOf } from "../src/prices";
import { parsePayments } from "../src/payments";
import { clusterByWalk, haversine } from "../src/geo";
import { rankCandidates, hubSuccessChance, type VisitCandidate } from "../src/scoring";
import { planTrip, mallVisitOrder } from "../src/trip";
import { inTrafficZone } from "../src/eta";

describe("prices", () => {
  it("labels quality", () => {
    expect(priceQuality(null)).toBe("missing");
    expect(priceQuality(12)).toBe("outlier");
    expect(priceQuality(7.3e17)).toBe("outlier");
    expect(priceQuality(3_640_000)).toBe("valid");
  });
  it("stats ignore outliers and flag suspicious prices", () => {
    const s = priceStats([100_000, 110_000, 120_000, 5]);
    expect(s).toMatchObject({ count: 3, min: 100_000, median: 110_000 });
    expect(isSuspicious(40_000, s)).toBe("low");
    expect(isSuspicious(105_000, s)).toBeNull();
  });
  it("freshness buckets", () => {
    const now = new Date("2026-10-21T00:00:00Z");
    expect(freshnessOf("2026-10-19T00:00:00Z", now)).toBe("fresh");
    expect(freshnessOf("2025-01-01T00:00:00Z", now)).toBe("stale");
    expect(freshnessOf(null, now, true)).toBe("confirmed");
  });
});

describe("payments", () => {
  it("parses providers and channels", () => {
    const p = parsePayments(
      '[{"category_names":[],"channel":"in_person","provider_name":"ترب‌پی"},{"channel":"unknown","provider_name":"اسنپ‌پی"}]',
    );
    expect(p.map((x) => [x.providerKey, x.channel])).toEqual([
      ["torobpay", "in_person"],
      ["snapppay", "unknown"],
    ]);
  });
});

describe("geo", () => {
  it("clusters walkable shops", () => {
    const a = { lat: 35.6949, lon: 51.4071 };
    const b = { lat: 35.6955, lon: 51.4075 }; // ~75m
    const c = { lat: 35.75, lon: 51.41 }; // far
    const hubs = clusterByWalk([a, b, c], 200);
    expect(hubs[0]!.members).toHaveLength(2);
    expect(hubs).toHaveLength(2);
    expect(haversine(a, b)).toBeLessThan(100);
  });
  it("detects the downtown traffic zone", () => {
    expect(inTrafficZone({ lat: 35.695, lon: 51.407 })).toBe(true);
    expect(inTrafficZone({ lat: 35.804, lon: 51.43 })).toBe(false); // Tajrish
  });
});

describe("scoring", () => {
  const base: VisitCandidate = {
    price: 1_000_000,
    distanceM: 500,
    openState: "open",
    openMinutesAfterArrival: 200,
    freshness: "fresh",
    neighbours: 0,
    hasWarranty: false,
    hasInstallment: false,
    listed: true,
  };
  it("prefers cheaper + open and explains why", () => {
    const r = rankCandidates(
      [
        { id: "a", c: { ...base, price: 900_000 } },
        { id: "b", c: { ...base, openState: "closed" as const, openMinutesAfterArrival: 0 } },
      ],
      (x) => x.c,
    );
    expect(r[0]!.item.id).toBe("a");
    expect(r[0]!.reasons).toContain("cheapest");
    expect(r[1]!.reasons).toContain("closed");
  });
  it("seller confirmation dominates trust", () => {
    const r = rankCandidates(
      [
        { id: "x", c: { ...base, freshness: "stale" as const, sellerConfirmed: "available" as const } },
        { id: "y", c: { ...base, sellerConfirmed: "unavailable" as const } },
      ],
      (x) => x.c,
      "surest",
    );
    expect(r[0]!.item.id).toBe("x");
  });
  it("hub success grows with open members", () => {
    expect(hubSuccessChance([{ open: true, trust: 0.9 }, { open: true, trust: 0.9 }])).toBeGreaterThan(
      hubSuccessChance([{ open: true, trust: 0.9 }]),
    );
    expect(hubSuccessChance([{ open: false, trust: 1 }])).toBe(0);
  });
});

describe("trip", () => {
  it("covers all items with few stops", () => {
    const o = { lat: 35.69, lon: 51.4 };
    const plan = planTrip(o, ["cable", "switch", "lamp"], [
      { shopId: "s1", lat: 35.695, lon: 51.407, covers: { cable: 100, switch: 50 } },
      { shopId: "s2", lat: 35.6952, lon: 51.4072, covers: { lamp: 30 } },
      { shopId: "s3", lat: 35.7, lon: 51.41, covers: { cable: 90 } },
    ]);
    expect(plan.uncovered).toEqual([]);
    expect(plan.stops.map((s) => s.shopId).sort()).toEqual(["s1", "s2"]);
    expect(plan.totalPrice).toBe(180);
  });
  it("orders mall visits floor by floor", () => {
    const order = mallVisitOrder([
      { floor: 2, unit: "201" },
      { floor: -1, unit: "5" },
      { floor: 0, unit: "24" },
      { floor: 0, unit: "3" },
    ]);
    expect(order.map((s) => `${s.floor}/${s.unit}`)).toEqual(["0/3", "0/24", "2/201", "-1/5"]);
  });
});

import { clusterCompact } from "../src/geo";
describe("clusterCompact", () => {
  it("keeps malls together and does not chain", () => {
    const line = Array.from({ length: 10 }, (_, i) => ({ lat: 35.69 + i * 0.0012, lon: 51.4, mall: null as string | null }));
    const hubs = clusterCompact(line, 180, (p) => p.mall);
    expect(Math.max(...hubs.map((h) => h.members.length))).toBeLessThan(5);
    const mall = [
      { lat: 35.69, lon: 51.4, mall: "a" },
      { lat: 35.699, lon: 51.4, mall: "a" },
    ];
    expect(clusterCompact(mall, 50, (p) => p.mall)).toHaveLength(1);
  });
});
