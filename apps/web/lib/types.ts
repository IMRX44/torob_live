import type { Freshness, PaymentOption, ReasonCode, WeeklyHours } from "@torob/core";

/** Shared DTOs between server routes, agent tools and UI cards. */

export interface Origin {
  lat: number;
  lon: number;
  label: string;
  source: "gps" | "preset" | "map" | "default";
}

export interface Filters {
  radiusKm: number | null; // null = whole city
  minPrice: number | null;
  maxPrice: number | null;
  openOnArrival: boolean;
  installment: boolean;
  torobPayInPerson: boolean;
  warranty: boolean;
  fastDelivery: boolean;
  verifiedOnly: boolean;
  priority: "balanced" | "cheapest" | "nearest" | "surest";
  mode: "walk" | "car" | "metro";
}

export const DEFAULT_FILTERS: Filters = {
  radiusKm: null,
  minPrice: null,
  maxPrice: null,
  openOnArrival: false,
  installment: false,
  torobPayInPerson: false,
  warranty: false,
  fastDelivery: false,
  verifiedOnly: false,
  priority: "balanced",
  mode: "car",
};

export interface ProductSummary {
  id: string;
  title: string;
  brand: string | null;
  category: string;
  image: string | null;
  sellerCount: number;
  priceMin: number | null;
  priceMedian: number | null;
  priceMax: number | null;
  lastChange: string | null;
  /** sellers within the user's radius, when an origin is known */
  nearbySellers?: number;
  nearestM?: number | null;
  keySpecs?: { key: string; value: string }[];
}

export interface SpecRow {
  section: string;
  key: string;
  value: string;
}

export interface ProductDetail extends ProductSummary {
  model: string | null;
  images: string[];
  specs: SpecRow[];
}

export interface ShopSummary {
  id: string;
  name: string;
  nameIsReal: boolean;
  address: string;
  area: string | null;
  lat: number;
  lon: number;
  mallId: string | null;
  mallName: string | null;
  floor: number | null;
  unit: string | null;
  phone: string | null;
  instagram: string | null;
  website: string | null;
  fastDelivery: boolean | null;
  payments: PaymentOption[];
  hours: WeeklyHours;
  categories: string[];
  offerCount: number;
}

export interface OpenInfo {
  state: "open" | "closed" | "unknown";
  label: string;
  /** minutes the shop remains open after the user arrives */
  openAfterArrival: number;
  closingSoon: boolean;
  overrideNote?: string | null;
}

export interface Warranty {
  provider: string | null;
  months: number | null;
  description: string | null;
}

export interface Confirmation {
  available: boolean;
  price: number | null;
  at: string;
  source: "seller" | "crowd";
}

/** One shop that (maybe) sells the product, already scored for the user. */
export interface ShopOffer {
  shop: ShopSummary;
  offerId: string | null;
  sellerTitle: string | null;
  description: string | null;
  price: number | null;
  priceQuality: "valid" | "missing" | "outlier" | "none";
  priceChangedAt: string | null;
  freshness: Freshness;
  warranty: Warranty | null;
  listed: boolean;
  confirmation: Confirmation | null;
  distanceM: number | null;
  etaMin: number | null;
  open: OpenInfo;
  neighbours: number;
  hubId: string | null;
  suspicious: "low" | "high" | null;
  score: number;
  reasons: ReasonCode[];
}

export interface HubSummary {
  id: string;
  label: string;
  mallId: string | null;
  lat: number;
  lon: number;
  sellerCount: number;
  openCount: number;
  priceMin: number | null;
  priceMax: number | null;
  successChance: number;
  distanceM: number | null;
  etaMin: number | null;
  shopIds: string[];
}

export interface ShopsForProduct {
  product: ProductSummary;
  offers: ShopOffer[];
  maybe: ShopOffer[];
  hubs: HubSummary[];
  stats: { count: number; min: number; max: number; median: number } | null;
  arrivalAt: string;
  trafficZone: boolean;
}
