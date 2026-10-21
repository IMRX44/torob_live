import { formatToman, normalizeFa, toLatinDigits } from "@torob/core";
import { findPlace, PLACES } from "../places";
import type { Filters } from "../types";

/**
 * Instant, rule-based reading of a Persian shopping request. It powers the first
 * results within milliseconds; the LLM refines on top of it.
 */
export interface ParsedIntent {
  query: string;
  filters: Partial<Filters>;
  place: { name: string; lat: number; lon: number } | null;
  nearMe: boolean;
  chips: string[]; // human-readable list of what we understood
}

const WORD_NUM: Record<string, number> = {
  یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  بیست: 20, سی: 30, چهل: 40, پنجاه: 50, صد: 100, دویست: 200, سیصد: 300, پانصد: 500,
};

function amount(numStr: string, unit: string | undefined): number | null {
  const n = WORD_NUM[numStr] ?? Number(numStr.replace(/[٫/]/, "."));
  if (!Number.isFinite(n)) return null;
  const u = unit ?? "";
  if (/میلیارد/.test(u)) return n * 1e9;
  if (/میلیون|ملیون|م\b|تومن? ?میلیون/.test(u)) return n * 1e6;
  if (/هزار|تومن|k/.test(u)) return n * 1e3;
  // bare numbers: "زیر ۲" in a shopping context almost always means millions
  return n < 1000 ? n * 1e6 : n;
}

const NUM = "(\\d+(?:[.٫/]\\d+)?|یک|یه|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده|بیست|سی|چهل|پنجاه|صد|دویست|سیصد|پانصد)";
const UNIT = "(میلیارد|میلیون|ملیون|هزار|تومن|تومان)?";

export function parseIntent(input: string): ParsedIntent {
  let text = toLatinDigits(input.replace(/‌/g, " ")).replace(/[،,؟?!]/g, " ");
  const filters: Partial<Filters> = {};
  const chips: string[] = [];

  const strip = (re: RegExp) => {
    text = text.replace(re, " ");
  };
  /** Persian-safe whole-word regex (JS \b only knows ASCII letters). */
  const W = (body: string, flags = "g") => new RegExp(`(?<=^|\\s)(?:${body})(?=\\s|$)`, flags);

  // budget ranges
  const between = text.match(new RegExp(`(?:بین|از)\\s*${NUM}\\s*${UNIT}\\s*(?:تا|و)\\s*${NUM}\\s*${UNIT}`));
  if (between) {
    const lo = amount(between[1]!, between[2] ?? between[4]);
    const hi = amount(between[3]!, between[4]);
    if (lo && hi) {
      filters.minPrice = lo;
      filters.maxPrice = hi;
      chips.push(`${formatToman(lo)} تا ${formatToman(hi)}`);
    }
    strip(new RegExp(between[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const max = text.match(new RegExp(`(?:زیر|کمتر از|حداکثر|نهایت|تا سقف|تا)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:تومان|تومن))?`));
  if (max && filters.maxPrice == null) {
    const v = amount(max[1]!, max[2]);
    if (v) {
      filters.maxPrice = v;
      chips.push(`تا ${formatToman(v)}`);
    }
    strip(new RegExp(max[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const around = text.match(new RegExp(`(?:حدود|حدودا|در حد|با بودجه)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:تومان|تومن))?`));
  if (around && filters.maxPrice == null) {
    const v = amount(around[1]!, around[2]);
    if (v) {
      filters.minPrice = Math.round(v * 0.7);
      filters.maxPrice = Math.round(v * 1.2);
      chips.push(`حدود ${formatToman(v)}`);
    }
    strip(new RegExp(around[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const min = text.match(new RegExp(`(?:بالای|بیشتر از|حداقل)\\s*${NUM}\\s*${UNIT}`));
  if (min && filters.minPrice == null) {
    const v = amount(min[1]!, min[2]);
    if (v) filters.minPrice = v;
    strip(new RegExp(min[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  if (/قسط|اقساط|اعتباری|اسنپ ?پی|دیجی ?پی|تارا|چک/.test(text)) {
    filters.installment = true;
    chips.push("خرید قسطی");
    strip(/(?:با\s*)?(?:خرید\s*)?(?:قسطی|اقساطی|اقساط|قسط|اعتباری)/g);
  }
  if (/ترب ?پی/.test(text)) {
    filters.torobPayInPerson = true;
    chips.push("ترب‌پی");
    strip(/ترب ?پی/g);
  }
  if (/الان باز|باز باشه|باز باشد|همین الان|الان برم|امروز/.test(text)) {
    filters.openOnArrival = true;
    chips.push("باز موقع رسیدن");
    strip(/(?:که\s*)?(?:الان باز(?:\s*باشه)?|باز باشه|باز باشد|همین الان)/g);
  }
  if (/گارانتی|ضمانت/.test(text)) {
    filters.warranty = true;
    chips.push("با گارانتی");
    strip(/(?:با\s*)?(?:گارانتی|ضمانت)(?:\s*دار)?/g);
  }
  if (/ارزون|ارزان|کمترین قیمت/.test(text)) {
    filters.priority = "cheapest";
    strip(/(?:ارزون ?ترین|ارزان ?ترین|ارزون|ارزان|کمترین قیمت)/g);
  }
  if (/نزدیک ?ترین/.test(text)) filters.priority = "nearest";
  if (/پیاده/.test(text)) filters.mode = "walk";
  if (/مترو/.test(text)) filters.mode = "metro";

  const nearMe = /نزدیک (?:من|خودم|خونه|محل)|اطراف من|دور و ?بر/.test(text);
  strip(W("(?:نزدیک|اطراف|حوالی|دور و ?بر|سمت|توی|تو|در|محدوده)(?:\\s+(?:من|خودم|خونه|محل))?"));

  let place: ParsedIntent["place"] = null;
  const found = findPlace(text);
  if (found) {
    place = { name: found.place.name, lat: found.place.lat, lon: found.place.lon };
    chips.push(`نزدیک ${found.place.name}`);
    for (const a of [found.place.name, ...found.place.aliases]) text = text.replace(a, " ");
  }

  const query = normalizeFa(
    text
      .replace(W("میخوام|می ?خوام|می ?خواهم|میخواستم|لازم دارم|دنبال|می ?گردم|بخرم|خرید|پیدا کن|کجا|بهترین|یه|یک|خوب|مناسب|لطفا|سلام|کدوم|چه|بگو|باشه|که|برام|برای من|تومان|تومن|میلیون|هزار|با|و|از|رو|را"), " ")
      .replace(W("میخوام|که|با|و"), " ")
      .replace(/\s+/g, " "),
  )
    .split(" ")
    .filter((w) => w.length > 1)
    .join(" ");

  return { query, filters, place, nearMe, chips };
}

export { PLACES };
