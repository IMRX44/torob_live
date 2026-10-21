import { DAY_KEYS, formatClock, formatToman, normalizeFa, tehranClock, toLatinDigits, toPersianDigits } from "@torob/core";
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
  /** user asked "where should I go" rather than "what should I buy" */
  wantsWhere: boolean;
  chips: string[]; // human-readable list of what we understood
}

const WORD_NUM: Record<string, number> = {
  یک: 1, یه: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10,
  یازده: 11, دوازده: 12, بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90,
  صد: 100, دویست: 200, سیصد: 300, پانصد: 500,
};

function amount(numStr: string, unit: string | undefined): number | null {
  const n = WORD_NUM[numStr] ?? Number(numStr.replace(/[٫/]/, "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit ?? "";
  if (/میلیارد/.test(u)) return n * 1e9;
  if (/میلیون|ملیون|تومن? ?میلیون/.test(u)) return n * 1e6;
  if (/هزار/.test(u)) return n * 1e3;
  if (/تومن|تومان/.test(u)) return n < 1000 ? n * 1e6 : n; // "۲ تومن" is slang for 2 million
  // bare numbers: "زیر ۲" in a shopping context almost always means millions
  return n < 1000 ? n * 1e6 : n;
}

const NUM = `(\\d+(?:[.٫/]\\d+)?|${Object.keys(WORD_NUM).sort((a, b) => b.length - a.length).join("|")})`;
const UNIT = "(میلیارد|میلیون|ملیون|هزار|تومن|تومان)?";
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const PERSIAN_DAYS: Record<string, (typeof DAY_KEYS)[number]> = {
  شنبه: "sat", یکشنبه: "sun", دوشنبه: "mon", "سه شنبه": "tue", سهشنبه: "tue", چهارشنبه: "wed", پنجشنبه: "thu", جمعه: "fri",
};

/** Filler that never helps a catalog search ("کجا برم که مطمئن باشم داره"). */
const FILLER = [
  "میخوام", "می خوام", "میخواهم", "می خواهم", "میخواستم", "می خواستم", "لازم دارم", "لازمه", "لازم", "دنبال", "میگردم", "می گردم",
  "بخرم", "بگیرم", "خرید", "پیدا کن", "پیدا کنم", "کجا", "کجاست", "برم", "برم که", "بریم", "بهترین", "خوب", "خوبی", "مناسب",
  "لطفا", "لطفاً", "سلام", "کدوم", "کدام", "چه", "چی", "بگو", "باشه", "باشد", "که", "برام", "واسم", "برای من", "برای", "واسه",
  "تومان", "تومن", "میلیون", "هزار", "با", "و", "از", "رو", "را", "یه", "یک", "مطمئن", "مطمین", "باشم", "داره", "دارن", "دارد",
  "داشته", "داشته باشه", "حتما", "حتماً", "الان", "امروز", "امشب", "فردا", "ساعت", "صبح", "ظهر", "عصر", "شب", "نمیدونم", "نمی دونم",
  "پیشنهاد", "بده", "بدی", "میدی", "کن", "کنی", "میتونی", "بکنی", "چیکار", "اصل", "اصلی", "اورجینال", "جدید", "میشه", "هست", "هستش",
  "ممنون", "مرسی", "یکی", "چند", "باز", "بازه", "بسته", "موجود", "موجوده", "دارید", "داری", "خوبه", "بهتره", "تا", "به", "در", "این", "اون", "همین", "نزدیک", "اطراف", "حوالی", "سمت", "توی", "تو", "شما", "من",
];
const FILLER_RE = new RegExp(`(?<=^|\\s)(?:${FILLER.sort((a, b) => b.length - a.length).map(esc).join("|")})(?=\\s|$)`, "g");

/** Next Date (absolute) for a Tehran wall-clock time, `dayOffset` days from today. */
function tehranAt(now: Date, dayOffset: number, minutes: number): Date {
  const { minutes: nowMin } = tehranClock(now);
  const midnight = now.getTime() - nowMin * 60_000 - (now.getTime() % 60_000);
  return new Date(midnight + dayOffset * 86_400_000 + minutes * 60_000);
}

/** "امشب ساعت ۸" / "فردا صبح" / "پنجشنبه عصر" → absolute visit time. */
export function parseVisitTime(text: string, now = new Date()): { at: Date; label: string } | null {
  const t = toLatinDigits(text.replace(/‌/g, " "));
  let dayOffset = 0;
  let dayLabel = "";
  let explicitDay = false;
  if (/پس ?فردا/.test(t)) {
    dayOffset = 2;
    dayLabel = "پس‌فردا";
    explicitDay = true;
  } else if (/فردا/.test(t)) {
    dayOffset = 1;
    dayLabel = "فردا";
    explicitDay = true;
  } else {
    for (const [name, key] of Object.entries(PERSIAN_DAYS).sort((a, b) => b[0].length - a[0].length)) {
      if (new RegExp(`(?<=^|\\s)${name}(?=\\s|$)`).test(t)) {
        const today = tehranClock(now).dayIndex;
        const target = DAY_KEYS.indexOf(key);
        dayOffset = (target - today + 7) % 7;
        dayLabel = dayOffset === 0 ? "امروز" : name;
        explicitDay = true;
        break;
      }
    }
  }
  let minutes: number | null = null;
  const m = t.match(new RegExp(`ساعت\\s*${NUM}(?:[:.](\\d{2}))?\\s*(صبح|ظهر|بعد ?از ?ظهر|عصر|شب)?`));
  if (m) {
    let h = WORD_NUM[m[1]!] ?? Number(m[1]);
    const part = m[3] ?? (/(?<=^|\s)(?:شب|امشب)(?=\s|$)/.test(t) ? "شب" : /عصر/.test(t) ? "عصر" : "");
    if (/شب|عصر|بعد/.test(part) && h < 12) h += 12;
    if (part === "ظهر" && h < 6) h += 12;
    if (!part && h >= 1 && h <= 7) h += 12; // "ساعت ۶" for shopping means 18:00
    minutes = h * 60 + (m[2] ? Number(m[2]) : 0);
  } else if (/امشب/.test(t)) minutes = 20 * 60;
  else if (/(?<=^|\s)صبح(?=\s|$)/.test(t)) minutes = 10 * 60;
  else if (/(?<=^|\s)ظهر(?=\s|$)/.test(t)) minutes = 13 * 60;
  else if (/(?<=^|\s)عصر(?=\s|$)/.test(t)) minutes = 17 * 60;
  else if (/(?<=^|\s)شب(?=\s|$)/.test(t)) minutes = 20 * 60;
  else if (explicitDay) minutes = 11 * 60;
  if (minutes == null) return null;
  if (/امشب/.test(t)) dayLabel = "امشب";
  // "ساعت ۱۰" when it's already 15:00 means tomorrow.
  if (!explicitDay && minutes < tehranClock(now).minutes - 30) {
    dayOffset = 1;
    dayLabel = "فردا";
  }
  const at = tehranAt(now, dayOffset, minutes);
  return { at, label: `${dayLabel || "امروز"} ساعت ${formatClock(minutes)}` };
}

export function parseIntent(input: string, now = new Date()): ParsedIntent {
  let text = toLatinDigits(input.replace(/‌/g, " ")).replace(/[،,؟?!.]/g, " ").replace(/\s+/g, " ");
  const filters: Partial<Filters> = {};
  const chips: string[] = [];
  const strip = (re: RegExp) => {
    text = text.replace(re, " ");
  };

  // ── budget ──
  const range = text.match(new RegExp(`(?:بین|از)?\\s*${NUM}\\s*${UNIT}\\s*(?:تا|-|الی)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:تومان|تومن))?`));
  if (range) {
    const hi = amount(range[3]!, range[4]);
    const lo = amount(range[1]!, range[2] ?? range[4]);
    if (lo && hi && hi > lo) {
      filters.minPrice = lo;
      filters.maxPrice = hi;
      chips.push(`${formatToman(lo)} تا ${formatToman(hi)}`);
      strip(new RegExp(esc(range[0])));
    }
  }
  const max = text.match(new RegExp(`(?:زیر|کمتر از|حداکثر|نهایتا|نهایت|تا سقف|سقف|تا)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:تومان|تومن))?`));
  if (max && filters.maxPrice == null) {
    const v = amount(max[1]!, max[2]);
    if (v && (max[2] || /زیر|کمتر|حداکثر|سقف|نهایت/.test(max[0]) || v >= 100_000)) {
      filters.maxPrice = v;
      chips.push(`تا ${formatToman(v)}`);
      strip(new RegExp(esc(max[0])));
    }
  }
  const around = text.match(new RegExp(`(?:حدود|حدودا|حدوداً|در حد|با بودجه|بودجه(?:م)?)\\s*${NUM}\\s*${UNIT}(?:\\s*(?:تومان|تومن))?`));
  if (around && filters.maxPrice == null) {
    const v = amount(around[1]!, around[2]);
    if (v) {
      filters.minPrice = Math.round(v * 0.7);
      filters.maxPrice = Math.round(v * 1.2);
      chips.push(`حدود ${formatToman(v)}`);
    }
    strip(new RegExp(esc(around[0])));
  }
  const min = text.match(new RegExp(`(?:بالای|بیشتر از|حداقل)\\s*${NUM}\\s*${UNIT}`));
  if (min && filters.minPrice == null) {
    const v = amount(min[1]!, min[2]);
    if (v) {
      filters.minPrice = v;
      chips.push(`از ${formatToman(v)}`);
    }
    strip(new RegExp(esc(min[0])));
  }

  // ── visit time ──
  const visit = parseVisitTime(text, now);
  if (visit) {
    filters.visitAt = visit.at.toISOString();
    filters.openOnArrival = true;
    chips.push(visit.label);
    strip(new RegExp(`ساعت\\s*${NUM}(?:[:.]\\d{2})?\\s*(?:صبح|ظهر|بعد ?از ?ظهر|عصر|شب)?`, "g"));
  }

  // ── purchase conditions ──
  if (/قسط|اقساط|اعتباری|اسنپ ?پی|دیجی ?پی|تارا|(?<=^|\s)چکی(?=\s|$)/.test(text)) {
    filters.installment = true;
    chips.push("خرید قسطی");
    strip(/(?:با\s*)?(?:خرید\s*)?(?:قسطی|اقساطی|اقساط|قسط|اعتباری|چکی)/g);
  }
  if (/ترب ?پی/.test(text)) {
    filters.torobPayInPerson = true;
    chips.push("ترب‌پی");
    strip(/ترب ?پی/g);
  }
  if (!visit && /الان باز|باز باشه|باز باشد|همین الان|الان برم|الان کجا|الان میرم/.test(text)) {
    filters.openOnArrival = true;
    chips.push("باز موقع رسیدن");
  }
  if (/گارانتی|ضمانت/.test(text)) {
    filters.warranty = true;
    chips.push("با گارانتی");
    strip(/(?:با\s*)?(?:گارانتی|ضمانت)(?:\s*دار)?/g);
  }
  if (/ارزون|ارزان|کمترین قیمت|اقتصادی/.test(text)) {
    filters.priority = "cheapest";
    strip(/(?:ارزون ?ترین|ارزان ?ترین|ارزون|ارزان|کمترین قیمت|اقتصادی)/g);
  }
  if (/نزدیک ?ترین/.test(text)) {
    filters.priority = "nearest";
    strip(/نزدیک ?ترین/g);
  }
  if (/مطمئن|حتما داشته|حتماً داشته|دست ?خالی/.test(text)) filters.priority = filters.priority ?? "surest";
  if (/پیاده/.test(text)) {
    filters.mode = "walk";
    strip(/پیاده/g);
  }
  if (/مترو/.test(text)) {
    filters.mode = "metro";
    strip(/(?:با\s*)?مترو/g);
  }

  const nearMe = /نزدیک (?:من|خودم|خونه|محل)|اطراف من|دور و ?بر/.test(text);
  const wantsWhere = /کجا|کدوم مغازه|کدوم فروشگاه|کدام فروشگاه|از کی بخرم|آدرس|نزدیک/.test(text);

  let place: ParsedIntent["place"] = null;
  const found = findPlace(text);
  if (found) {
    place = { name: found.place.name, lat: found.place.lat, lon: found.place.lon };
    chips.push(`نزدیک ${found.place.name}`);
    for (const a of [found.place.name, ...found.place.aliases].sort((x, y) => y.length - x.length)) text = text.replace(a, " ");
  }

  for (const [name] of Object.entries(PERSIAN_DAYS)) text = text.replace(new RegExp(`(?<=^|\\s)${name}(?=\\s|$)`, "g"), " ");
  const query = normalizeFa(text.replace(FILLER_RE, " ").replace(FILLER_RE, " "))
    .split(" ")
    .filter((w) => w.length > 1 || /\d/.test(w))
    .join(" ");

  return { query, filters, place, nearMe, wantsWhere, chips };
}

export { PLACES, toPersianDigits };
