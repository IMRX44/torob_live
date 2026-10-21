import "server-only";
import { tool } from "ai";
import { z } from "zod";
import { searchProducts } from "../server/search";
import { getProductsByIds, shopsForProduct, withNearby } from "../server/catalog";
import { buildTrip } from "../server/trip";
import { listInquiries } from "../server/inquiries";
import { sql } from "../server/db";
import { sanitizeDeep } from "./guard";
import { boardDdr, boardSocket, cpuBoardCompatible, ramBoardCompatible } from "@torob/core";
import type { ProductSummary } from "../types";
import type { Filters, Origin, ProductDetail, ShopOffer } from "../types";

export interface ToolCtx {
  origin: Origin;
  filters: Filters;
  known: Map<string, unknown>;
  sessionId: string;
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

let categoryCache: { at: number; names: Set<string> } | null = null;
async function knownCategories() {
  if (!categoryCache || Date.now() - categoryCache.at > 10 * 60_000) {
    const rows = await sql()<{ name: string }[]>`SELECT name FROM categories`;
    categoryCache = { at: Date.now(), names: new Set(rows.map((r) => r.name)) };
  }
  return categoryCache.names;
}

type Slot = { key: string; label: string; query: string; category?: string; share: number; optional?: boolean; exclude?: string[] };

/** Words that mean "not a PC part" for common slots (an organ's mainboard is not a motherboard). */
const DEFAULT_EXCLUDE: Record<string, string[]> = {
  مادربرد: ["ارگ", "کیبورد", "موبایل", "گوشی", "لپ تاپ", "لپتاپ", "تلویزیون", "ماشین لباسشویی", "کولر"],
  پردازنده: ["گوشی", "موبایل", "لپ تاپ"],
  "رم کامپیوتر": ["لپ تاپ", "لپتاپ", "نوت بوک"],
  "کارت گرافیک": ["لپ تاپ"],
};

/** Parts whose catalog neighbours are easy to confuse: a PC power supply is not a power bank or a 12V industrial unit. */
const SLOT_REQUIRE: [RegExp, RegExp][] = [
  [/psu|power ?supply|پاور|منبع تغذیه/i, /(کامپیوتر|atx|گیمینگ|corsair|کورسیر|cooler ?master|کولر ?مستر|seasonic|سیسونیک|thermaltake|ترمالتیک)/i],
  [/case|کیس/i, /کیس/],
  [/cooler|خنک|فن پردازنده/i, /(پردازنده|cpu|خنک کننده)/i],
];

/**
 * Best product for one build slot. Relevance first (top search hits), then the most capable
 * listing that fits the slot budget; if the precise model is out of budget, widen to the whole
 * category inside the budget before giving up.
 */
async function fillSlot(slot: Slot, slotBudget: number, origin: Origin) {
  const cats = await knownCategories();
  const category = slot.category && cats.has(slot.category) ? slot.category : null;
  const banned = [...(slot.exclude ?? []), ...(category ? DEFAULT_EXCLUDE[category] ?? [] : [])].map((w) => w.trim()).filter(Boolean);
  const required = SLOT_REQUIRE.find(([slotRe]) => slotRe.test(slot.key) || slotRe.test(slot.label))?.[1] ?? null;
  const usable = (xs: ProductSummary[]) =>
    xs.filter(
      (x) =>
        x.priceMin != null &&
        x.sellerCount > 0 &&
        !banned.some((w) => x.title.includes(w)) &&
        !/پاوربانک|power ?bank/i.test(x.title) &&
        (!required || required.test(x.title)),
    );
  const value = (p: ProductSummary) => p.priceMin! * (1 + Math.log1p(p.sellerCount) * 0.12);
  const ceiling = Math.round(slotBudget * 1.15);

  // 1) the requested model, inside the budget, among the most relevant hits
  let pool = usable(await searchProducts({ q: slot.query, category, maxPrice: ceiling, limit: 10 }));
  let status: "ok" | "over" | "missing" = "ok";
  let widened = false;
  // 2) anything good in the same category that fits the budget
  if (!pool.length && category) {
    pool = usable(await searchProducts({ q: category, category, maxPrice: ceiling, limit: 30 }));
    widened = true;
  }
  // 3) nothing fits: cheapest relevant option, flagged as over budget
  if (!pool.length) {
    pool = usable(await searchProducts({ q: slot.query, category, limit: 10 })).sort((a, b) => a.priceMin! - b.priceMin!);
    status = pool.length ? "over" : "missing";
  }
  const relevant = widened ? pool : pool.slice(0, 8);
  const pick = status === "ok" ? [...relevant].sort((a, b) => value(b) - value(a))[0] ?? null : (pool[0] ?? null);
  const cheaper = pool.filter((p) => pick && p.id !== pick.id && p.priceMin! < pick.priceMin!).sort((a, b) => b.priceMin! - a.priceMin!)[0] ?? null;
  // Stronger option: the next step up for the same query, or anywhere in the category if the
  // precise model was unaffordable (so leftover budget can still upgrade, e.g. GTX 1650 → RTX 3050).
  const upFrom = async (q: string) =>
    usable(await searchProducts({ q, category, minPrice: pick!.priceMin! + 1, maxPrice: Math.round(slotBudget * 1.8), limit: 12 }))
      .filter((p) => p.id !== pick!.id)
      .sort((a, b) => a.priceMin! - b.priceMin!)[0] ?? null;
  let stepUp = pick ? await upFrom(widened && category ? category : slot.query) : null;
  if (pick && !stepUp && category && !widened) stepUp = await upFrom(category);
  const options = await withNearby([pick, cheaper, stepUp].filter((p): p is ProductSummary => Boolean(p)), origin);
  const byId = new Map(options.map((o) => [o.id, o]));
  return {
    key: slot.key,
    label: slot.label,
    optional: Boolean(slot.optional),
    budget: Math.round(slotBudget),
    status,
    pick: pick ? byId.get(pick.id)! : null,
    cheaper: cheaper ? byId.get(cheaper.id)! : null,
    stepUp: stepUp ? byId.get(stepUp.id)! : null,
  };
}

type Filled = Awaited<ReturnType<typeof fillSlot>>;
const isSlot = (s: Filled, cat: string, words: RegExp) => s.key.toLowerCase().match(words) || s.label.match(words) || s.pick?.category === cat;

async function categoryPool(category: string, maxPrice: number, limit = 60) {
  const ban = DEFAULT_EXCLUDE[category] ?? [];
  return (await searchProducts({ q: category, category, maxPrice, limit })).filter(
    (p) => p.priceMin != null && p.sellerCount > 0 && !ban.some((w) => p.title.includes(w)),
  );
}

/**
 * Makes CPU, motherboard and RAM actually fit together: best compatible CPU/board pair inside
 * their combined budget (socket from model/chipset names), then RAM of the board's DDR generation.
 */
async function enforceCompatibility(slots: Filled[], origin: Origin) {
  const cpu = slots.find((s) => isSlot(s, "پردازنده", /cpu|پردازنده/i));
  const board = slots.find((s) => isSlot(s, "مادربرد", /motherboard|mainboard|board|مادربرد/i));
  const ram = slots.find((s) => isSlot(s, "رم کامپیوتر", /ram|memory|رم/i));
  const compat: { socket: string | null; ddr: string | null; cpuBoard: boolean | null; ram: boolean | null } = { socket: null, ddr: null, cpuBoard: null, ram: null };
  if (!cpu || !board) return compat;

  const pairBudget = (cpu.budget + board.budget) * 1.15;
  const [cpus, boards] = await Promise.all([categoryPool("پردازنده", pairBudget), categoryPool("مادربرد", pairBudget)]);
  const value = (p: ProductSummary) => p.priceMin! * (1 + Math.log1p(p.sellerCount) * 0.1);
  let best: { c: ProductSummary; b: ProductSummary; score: number } | null = null;
  for (const c of cpus)
    for (const b of boards) {
      if (cpuBoardCompatible(c.title, b.title) !== true) continue;
      const sum = c.priceMin! + b.priceMin!;
      if (sum > pairBudget) continue;
      const score = value(c) * 1.25 + value(b);
      if (!best || score > best.score) best = { c, b, score };
    }
  if (!best) {
    compat.cpuBoard = cpu.pick && board.pick ? cpuBoardCompatible(cpu.pick.title, board.pick.title) : null;
    return compat;
  }
  const others = (pool: ProductSummary[], partner: ProductSummary, chosen: ProductSummary, isCpu: boolean) => {
    const ok = pool.filter((p) => p.id !== chosen.id && (isCpu ? cpuBoardCompatible(p.title, partner.title) : cpuBoardCompatible(partner.title, p.title)) === true);
    return {
      cheaper: ok.filter((p) => p.priceMin! < chosen.priceMin!).sort((a, b) => b.priceMin! - a.priceMin!)[0] ?? null,
      stepUp: ok.filter((p) => p.priceMin! > chosen.priceMin!).sort((a, b) => a.priceMin! - b.priceMin!)[0] ?? null,
    };
  };
  const co = others(cpus, best.b, best.c, true);
  const bo = others(boards, best.c, best.b, false);
  const enrich = await withNearby([best.c, best.b, co.cheaper, co.stepUp, bo.cheaper, bo.stepUp].filter((p): p is ProductSummary => Boolean(p)), origin);
  const get = (p: ProductSummary | null) => (p ? enrich.find((e) => e.id === p.id) ?? p : null);
  Object.assign(cpu, { pick: get(best.c), cheaper: get(co.cheaper), stepUp: get(co.stepUp), status: "ok" });
  Object.assign(board, { pick: get(best.b), cheaper: get(bo.cheaper), stepUp: get(bo.stepUp), status: "ok" });
  compat.cpuBoard = true;
  compat.socket = boardSocket(best.b.title);
  compat.ddr = boardDdr(best.b.title);

  if (ram && compat.ddr) {
    // A compatible stick slightly over budget beats an incompatible one: widen before giving up.
    const fits = (r: ProductSummary) => ramBoardCompatible(r.title, best.b.title) === true;
    let status: "ok" | "over" = "ok";
    let matching = (await categoryPool("رم کامپیوتر", ram.budget * 1.3, 60)).filter(fits);
    if (!matching.length) {
      matching = (await categoryPool("رم کامپیوتر", ram.budget * 5, 60)).filter(fits).sort((a, b) => a.priceMin! - b.priceMin!);
      status = "over";
    }
    const pick = status === "ok" ? [...matching].sort((a, b) => value(b) - value(a))[0] : matching[0];
    if (pick) {
      const stepUp = matching.filter((r) => r.priceMin! > pick.priceMin!).sort((a, b) => a.priceMin! - b.priceMin!)[0] ?? null;
      const enriched = await withNearby([pick, stepUp].filter((p): p is ProductSummary => Boolean(p)), origin);
      Object.assign(ram, { pick: enriched[0], cheaper: null, stepUp: stepUp ? enriched[1] : null, status });
      compat.ram = true;
    } else compat.ram = ram.pick ? ramBoardCompatible(ram.pick.title, best.b.title) : null;
  }
  return compat;
}

/** If the build overshoots, step the parts with the biggest overshoot down to their cheaper option. */
function rebalance<T extends { pick: ProductSummary | null; cheaper: ProductSummary | null; stepUp: ProductSummary | null; budget: number }>(slots: T[], budget: number) {
  const total = () => slots.reduce((s, x) => s + (x.pick?.priceMin ?? 0), 0);
  const order = [...slots].sort((a, b) => (b.pick?.priceMin ?? 0) - b.budget - ((a.pick?.priceMin ?? 0) - a.budget));
  for (const s of order) {
    if (total() <= budget) break;
    if (s.cheaper && s.pick) {
      s.stepUp = s.pick;
      s.pick = s.cheaper;
      s.cheaper = null;
    }
  }
  // Money left over: upgrade the parts with the biggest budget share first (the GPU in a gaming build).
  for (const s of [...slots].sort((a, b) => b.budget - a.budget)) {
    if (!s.pick || !s.stepUp) continue;
    if (total() - s.pick.priceMin! + s.stepUp.priceMin! > budget) continue;
    const prev = s.pick;
    s.pick = s.stepUp;
    s.cheaper = prev;
    s.stepUp = null;
  }
  return total();
}

export function buildTools(ctx: ToolCtx) {
  const tools = {
    planBuild: tool({
      description:
        "برای «یک سیستم/مجموعه بساز» با بودجه (کامپیوتر گیمینگ، سیستم رندر، ست استریم، دوربین مداربسته مغازه، ست صوتی ماشین…): قطعات لازم را با سهم بودجه تعریف کن تا برای هر قطعه محصول واقعی موجود در مغازه‌ها، گزینه ارزان‌تر و گزینه قوی‌تر پیدا شود و جمع کل حساب شود. نام دسته دقیق را اگر می‌دانی بده (مثل «پردازنده»، «کارت گرافیک»، «مادربرد»، «رم کامپیوتر»، «حافظه SSD»، «مانیتور»، «کیبورد»، «ماوس»، «هدفون، هدست و هندزفری»، «منبع تغذیه سوییچینگ»).",
      inputSchema: z.object({
        title: z.string().describe("مثل «سیستم گیمینگ ۱۰۰ میلیونی»"),
        budget: z.number().positive().describe("کل بودجه به تومان"),
        purpose: z.string().optional().describe("کاربرد، مثل «بازی‌های سنگین 1080p»"),
        slots: z
          .array(
            z.object({
              key: z.string(),
              label: z.string().describe("نام قطعه برای کاربر"),
              query: z.string().describe("عبارت جستجوی کوتاه، مثل «کارت گرافیک RTX 4060»"),
              category: z.string().optional(),
              share: z.number().min(0.01).max(0.9).describe("سهم از بودجه کل"),
              optional: z.boolean().optional(),
              exclude: z.array(z.string()).max(6).optional().describe("کلماتی که نباید در عنوان باشد، مثل «لپ تاپ» برای رم دسکتاپ"),
            }),
          )
          .min(2)
          .max(10),
        notes: z.array(z.string()).max(4).optional().describe("نکات سازگاری و خرید، کوتاه"),
      }),
      execute: async ({ title, budget, purpose, slots, notes }) => {
        const totalShare = slots.reduce((s, x) => s + x.share, 0) || 1;
        const filled = await Promise.all(slots.map((s) => fillSlot(s, (budget * s.share) / totalShare, ctx.origin)));
        const compat = await enforceCompatibility(filled, ctx.origin);
        const total = rebalance(filled, budget);
        return { title, budget, purpose: purpose ?? null, slots: filled, total, notes: notes ?? [], compat };
      },
    }),

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
      description:
        "مقایسه ۲ یا ۳ محصول از نظر قیمت، تعداد فروشنده و مشخصات فنی. اگر شناسه محصول را داری productIds بده؛ اگر فقط اسم را می‌دانی names بده تا خودم پیدا کنم (نیازی به searchCatalog قبلش نیست).",
      inputSchema: z.object({
        productIds: z.array(z.string()).max(3).optional(),
        names: z.array(z.string()).max(3).optional().describe("نام محصولات، مثل «ایرپاد پرو ۲»"),
      }),
      execute: async ({ productIds, names }) => {
        const ids = [...(productIds ?? [])];
        for (const n of names ?? []) {
          const [hit] = await searchProducts({ q: n, limit: 1 });
          if (hit && !ids.includes(hit.id)) ids.push(hit.id);
        }
        const products = await withNearby(await getProductsByIds(ids.slice(0, 3)), ctx.origin);
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
      description:
        "آماده کردن استعلام قیمت/موجودی از فروشنده‌ها؛ کاربر با یک لمس ارسال می‌کند. اگر shopIds را نمی‌دانی خالی بگذار تا ۳ فروشنده برتر و باز خودکار انتخاب شوند (لازم نیست اول findShops بزنی).",
      inputSchema: z.object({ productId: z.string(), shopIds: z.array(z.string()).max(5).optional(), count: z.number().int().min(1).max(5).optional() }),
      execute: async ({ productId, shopIds, count }) => {
        const data = await shopsForProduct({ productId, origin: ctx.origin, filters: ctx.filters });
        const all = (data?.offers ?? []).filter((o) => !(o.confirmation && !o.confirmation.available));
        const offers = shopIds?.length
          ? all.filter((o) => shopIds.includes(o.shop.id))
          : all.filter((o) => o.open.state !== "closed").slice(0, count ?? 3);
        return { productId, productTitle: data?.product.title ?? "", offers: offers.map(compactOffer) };
      },
    }),

    suggestList: tool({
      description:
        "برای نیازهای پروژه‌ای یا چندقلمی (مثل «برق‌کشی یک واحد»، «راه‌اندازی دوربین مغازه»، «وسایل اولیه آشپزخانه») یک لیست خرید عملی بساز با مقدار تقریبی و دلیل؛ کاربر می‌تواند با یک لمس سفر خرید بچیند.",
      inputSchema: z.object({
        title: z.string(),
        items: z
          .array(z.object({ label: z.string().describe("نام قابل‌جستجو، کوتاه، مثل «سیم افشان ۲.۵»"), qty: z.string().optional(), why: z.string().optional() }))
          .min(2)
          .max(10),
        tip: z.string().optional().describe("یک نکته کوتاه حرفه‌ای"),
      }),
      execute: async ({ title, items, tip }) => {
        const withCounts = await Promise.all(
          items.map(async (it) => {
            const [top] = await withNearby(await searchProducts({ q: it.label, limit: 1 }), ctx.origin);
            return { ...it, sample: top ? { id: top.id, title: top.title, priceMin: top.priceMin, sellers: top.sellerCount, nearby: top.nearbySellers ?? 0 } : null };
          }),
        );
        return { title, items: withCounts, tip: tip ?? null };
      },
    }),

    myInquiries: tool({
      description: "وضعیت استعلام‌هایی که کاربر از فروشنده‌ها گرفته (چه کسی تأیید کرد، قیمت جدید، رزرو، چه کسی جواب نداد).",
      inputSchema: z.object({}),
      execute: async () => {
        const list = await listInquiries(ctx.sessionId, 5);
        return {
          inquiries: list.map((i) => ({
            id: i.id,
            product: i.productTitle,
            productId: i.productId,
            createdAt: i.createdAt,
            targets: i.targets.map((t) => ({ shop: t.shopName, shopId: t.shopId, mall: t.mallName, status: t.status, price: t.replyPrice ?? t.listedPrice, holdUntil: t.holdUntil, alt: t.altProductTitle })),
          })),
        };
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
  // The model only ever sees sanitised, image-free copies of tool results (the UI gets the full data).
  for (const t of Object.values(tools)) {
    (t as { toModelOutput?: (o: unknown) => unknown }).toModelOutput = (o: unknown) => ({ type: "json", value: sanitizeDeep(o) });
  }
  return tools;
}

export type AgentTools = ReturnType<typeof buildTools>;
