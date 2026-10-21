import { normalizeFa, toLatinDigits } from "./text";

/** Where inside a building a shop is, parsed from the free-text address. */
export interface ParsedAddress {
  /** Display name of the mall/building as written, e.g. "پاساژ علاءالدین ۲". */
  mallName: string | null;
  /** Stable key for grouping spelling variants of the same mall. */
  mallKey: string | null;
  floor: number | null;
  floorLabel: string | null;
  unit: string | null;
}

const MALL_RE =
  /(پاساژ|پاساط|مجتمع تجاری|مجتمع|مرکز خرید|مرکز تجاری|بازار|سرای|تیمچه|ساختمان|برج)\s*([^،,]*)/;

const FLOOR_WORDS: [RegExp, number][] = [
  [/^(?:بالای\s*همکف)/, 1],
  [/^(?:همکف)/, 0],
  [/^(?:زیر\s*همکف|زیر\s*زمین|زیرزمین|زیرین)/, -1],
  [/^منفی\s*(?:یک|1)(?!\d)/, -1],
  [/^منفی\s*(?:دو|2)(?!\d)/, -2],
  [/^منفی\s*(?:سه|3)(?!\d)/, -3],
  [/^(?:اول|یکم)/, 1],
  [/^دوم/, 2],
  [/^سوم/, 3],
  [/^چهارم/, 4],
  [/^پنجم/, 5],
  [/^ششم/, 6],
  [/^هفتم/, 7],
  [/^هشتم/, 8],
  [/^نهم/, 9],
  [/^دهم/, 10],
];

/** Known spelling variants → canonical mall key. */
const MALL_ALIASES: [RegExp, string][] = [
  [/^علا ?ا?لدین|^علادین|^علایدین/, "علاالدین"],
  [/^چهار ?سو|^چارسو/, "چارسو"],
  [/^(?:سرای )?لاله ?زار/, "لاله زار"],
];

export function floorLabel(floor: number | null): string | null {
  if (floor == null) return null;
  if (floor === 0) return "همکف";
  if (floor < 0) return floor === -1 ? "زیرهمکف" : `منفی ${toPersianInt(-floor)}`;
  return `طبقه ${toPersianInt(floor)}`;
}

function toPersianInt(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]!);
}

export function parseFloor(text: string): number | null {
  const m = toLatinDigits(text).match(/طبقه\s*([^،,]{0,16})/);
  if (!m) return null;
  const rest = m[1]!.trim();
  const num = rest.match(/^(-?\d+)(-)?/);
  if (num) {
    const n = Number(num[1]);
    return num[2] ? -n : n;
  }
  for (const [re, n] of FLOOR_WORDS) if (re.test(rest)) return n;
  return null;
}

export function parseUnit(text: string): string | null {
  const m = toLatinDigits(text).match(/(?:واحد|غرفه|پلاک|مغازه)\s*([a-zA-Z]?\s?[\d\/.]+(?:\s*و\s*\d+)?|یک)/);
  if (!m) return null;
  return m[1]!.replace(/\s+/g, " ").trim().replace("یک", "1");
}

export function mallKeyOf(name: string): string {
  let n = normalizeFa(name)
    .replace(/^(پاساژ|پاساط|مجتمع تجاری|مجتمع|مرکز خرید|مرکز تجاری|بازار|تیمچه|ساختمان|برج)\s*/, "")
    .trim();
  // "فراز لاله زار" / "تجارت جهانی فردوسی" → street suffix adds nothing inside one area.
  const stripped = n.replace(/\s+(?:لاله ?زار(?: نو| جنوبی)?|فردوسی|جمهوری|تجریش)$/, "").trim();
  if (stripped && !/^(?:سرای|بازار|مرکز)$/.test(stripped)) n = stripped;
  n = n.replace(/^(\d+) /, "$1 ").trim();
  if (/^علا.*\s1$/.test(n)) n = n.replace(/\s1$/, "");
  for (const [re, key] of MALL_ALIASES) {
    if (re.test(n)) {
      const suffix = n.replace(re, "").trim();
      n = suffix ? `${key} ${suffix}` : key;
      break;
    }
  }
  return n;
}

export function parseAddress(address: string | null | undefined): ParsedAddress {
  const text = address ?? "";
  let mallName: string | null = null;
  // Skip "نرسیده به پاساژ X" / "روبروی پاساژ X" / "نبش پاساژ X": those point near, not inside.
  for (const part of text.split(/[،,]/)) {
    const p = part.trim();
    if (/^(?:نرسیده|روبرو|روبه ?رو|نبش|جنب|بعد از|قبل از|کنار|پشت)/.test(p)) continue;
    const m = p.match(MALL_RE);
    if (m && m[2] && m[2].trim().length > 1) {
      mallName = `${m[1] === "پاساط" ? "پاساژ" : m[1]} ${m[2].trim()}`.replace(/\s+/g, " ");
      break;
    }
  }
  const floor = parseFloor(text);
  return {
    mallName,
    mallKey: mallName ? mallKeyOf(mallName) : null,
    floor,
    floorLabel: floorLabel(floor),
    unit: parseUnit(text),
  };
}
