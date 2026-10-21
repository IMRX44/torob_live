import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { searchProducts } from "../server/search";
import { getProductsByIds, shopsForProduct, withNearby } from "../server/catalog";
import { buildTrip } from "../server/trip";
import type { Filters, Origin, ProductDetail, ShopOffer } from "../types";

export interface ToolCtx {
  origin: Origin;
  filters: Filters;
  known: Map<string, unknown>;
}

const compactOffer = (o: ShopOffer) => ({
  shopId: o.shop.id,
  name: o.shop.name,
  mall: o.shop.mallName,
  floor: o.shop.floor,
  unit: o.shop.unit,
  price: o.price,
  priceChangedAt: o.priceChangedAt,
  freshness: o.freshness,
  open: o.open,
  distanceM: Math.round(o.distanceM ?? 0),
  etaMin: Math.round(o.etaMin ?? 0),
  installment: o.shop.payments.length > 0,
  warranty: Boolean(o.warranty),
  confirmed: o.confirmation?.available ?? null,
  reasons: o.reasons,
  score: o.score,
});

/** Spec rows aligned across products; rows where values differ are flagged. */
export function alignSpecs(products: ProductDetail[]) {
  const keys: string[] = [];
  for (const p of products) for (const s of p.specs) if (!keys.includes(s.key) && keys.length < 40) keys.push(s.key);
  const rows = keys
    .map((k) => {
      const values = products.map((p) => p.specs.find((s) => s.key === k)?.value ?? null);
      const present = values.filter(Boolean).length;
      return { key: k, values, differs: new Set(values.filter(Boolean)).size > 1, present };
    })
    .filter((r) => r.present >= Math.min(2, products.length))
    .sort((a, b) => Number(b.differs) - Number(a.differs));
  return rows.slice(0, 18);
}

export function buildTools(ctx: ToolCtx) {
  return {
    searchCatalog: tool({
      description: "جستجوی دوباره در کاتالوگ با عبارت دقیق‌تر یا محدودیت قیمت/دسته. خروجی فهرست فشرده محصولات است.",
      inputSchema: z.object({
        query: z.string().describe("عبارت جستجو به فارسی، مثل «هندزفری بلوتوث انکر»"),
        maxPrice: z.number().optional().describe("سقف قیمت به تومان"),
        minPrice: z.number().optional(),
        category: z.string().optional().describe("نام دقیق دسته اگر معلوم است"),
      }),
      execute: async ({ query, maxPrice, minPrice, category }) => {
        const items = await withNearby(
          await searchProducts({ q: query, maxPrice: maxPrice ?? ctx.filters.maxPrice, minPrice: minPrice ?? ctx.filters.minPrice, category, limit: 12 }),
          ctx.origin,
        );
        items.forEach((i) => ctx.known.set(i.id, i));
        return { query, items };
      },
    }),

    present: tool({
      description: "نمایش پیشنهادهای نهایی به کاربر به شکل کارت: حداکثر ۳ محصول با برچسب و دلیل، یک سؤال روشن‌کننده اختیاری و پیشنهادهای قدم بعد.",
      inputSchema: z.object({
        picks: z
          .array(
            z.object({
              productId: z.string(),
              label: z.string().describe("برچسب کوتاه مثل «بهترین ارزش»"),
              reasons: z.array(z.string()).max(3).describe("دلیل‌های کوتاه و واقعی"),
            }),
          )
          .max(3),
        question: z
          .object({ text: z.string(), options: z.array(z.string()).min(2).max(5) })
          .optional()
          .describe("فقط اگر نیاز کاربر مبهم است"),
        followups: z.array(z.string()).max(4).optional(),
      }),
      execute: async ({ picks, question, followups }) => {
        const products = await withNearby(await getProductsByIds(picks.map((p) => p.productId)), ctx.origin);
        const byId = new Map(products.map((p) => [p.id, p]));
        return {
          picks: picks
            .filter((p) => byId.has(p.productId))
            .map((p) => {
              const { specs: _s, images: _i, ...summary } = byId.get(p.productId)!;
              return { ...p, product: summary };
            }),
          question: question ?? null,
          followups: followups ?? [],
        };
      },
    }),

    compareProducts: tool({
      description: "مقایسه ۲ یا ۳ محصول از نظر قیمت، تعداد فروشنده و مشخصات فنی.",
      inputSchema: z.object({ productIds: z.array(z.string()).min(2).max(3) }),
      execute: async ({ productIds }) => {
        const products = await withNearby(await getProductsByIds(productIds), ctx.origin);
        return {
          products: products.map(({ specs: _s, images: _i, ...p }) => p),
          rows: alignSpecs(products),
        };
      },
    }),

    findShops: tool({
      description: "پیدا کردن و رتبه‌بندی فروشنده‌های یک محصول نسبت به مبدأ کاربر (فاصله، باز بودن موقع رسیدن، قیمت، تازگی قیمت، خوشه فروشنده‌ها).",
      inputSchema: z.object({ productId: z.string() }),
      execute: async ({ productId }) => {
        const data = await shopsForProduct({ productId, origin: ctx.origin, filters: ctx.filters });
        if (!data) return { error: "محصول پیدا نشد" };
        return {
          product: { id: data.product.id, title: data.product.title, image: data.product.image },
          total: data.offers.length,
          top: data.offers.slice(0, 4).map(compactOffer),
          hub: data.hubs[0] ?? null,
          stats: data.stats,
          trafficZone: data.trafficZone,
        };
      },
    }),

    proposeInquiry: tool({
      description: "پیشنهاد ارسال استعلام قیمت/موجودی به چند فروشنده؛ کاربر با یک لمس تأیید و ارسال می‌کند.",
      inputSchema: z.object({ productId: z.string(), shopIds: z.array(z.string()).min(1).max(5) }),
      execute: async ({ productId, shopIds }) => {
        const data = await shopsForProduct({ productId, origin: ctx.origin, filters: ctx.filters });
        const offers = (data?.offers ?? []).filter((o) => shopIds.includes(o.shop.id));
        return { productId, productTitle: data?.product.title ?? "", offers: offers.map(compactOffer) };
      },
    }),

    planTrip: tool({
      description: "برنامه‌ریزی سفر خرید برای چند قلم مختلف با کمترین توقف و مسیر، با توجه به ساعت کاری.",
      inputSchema: z.object({ items: z.array(z.string()).min(2).max(6).describe("اقلام به زبان کاربر، مثل «کابل ۲.۵»") }),
      execute: async ({ items }) => {
        const trip = await buildTrip(ctx.origin, items.map((label) => ({ label })));
        return {
          stops: trip.stops.map((s) => ({
            shopId: s.shop.id,
            name: s.shop.name,
            mall: s.shop.mallName,
            floor: s.shop.floor,
            unit: s.shop.unit,
            lat: s.shop.lat,
            lon: s.shop.lon,
            items: s.items,
            arriveAt: s.arriveAt,
            open: s.open,
            warning: s.warning,
            travelMin: Math.round(s.travelMin),
            travelMode: s.travelMode,
          })),
          uncovered: trip.uncovered,
          totalPrice: trip.totalPrice,
          totalMinutes: Math.round(trip.totalMinutes),
          trafficZone: trip.trafficZone,
          items,
        };
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof buildTools>;
