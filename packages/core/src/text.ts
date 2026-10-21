/** Persian text normalization shared by ingest, search and UI. */

const ARABIC_TO_PERSIAN: Record<string, string> = {
  "ي": "ی",
  "ى": "ی",
  "ئ": "ی",
  "ك": "ک",
  "ة": "ه",
  "ۀ": "ه",
  "ؤ": "و",
  "أ": "ا",
  "إ": "ا",
  "ٱ": "ا",
};

const DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) => {
    const i = DIGITS.indexOf(d);
    return String(i >= 0 ? i : AR_DIGITS.indexOf(d));
  });
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => DIGITS[Number(d)]!);
}

/**
 * Canonical form for matching: unified letters, latin digits, no diacritics,
 * hamza dropped, ZWNJ/punctuation turned into spaces, lowercased.
 */
export function normalizeFa(input: string | null | undefined): string {
  if (!input) return "";
  let s = input.replace(/[يىئكةۀؤأإٱ]/g, (c) => ARABIC_TO_PERSIAN[c] ?? c);
  s = toLatinDigits(s);
  s = s
    .replace(/[ً-ٰٟـ]/g, "") // harakat, superscript alef, tatweel
    .replace(/ء/g, "")
    .replace(/[‌‍‎‏]/g, " ")
    .toLowerCase()
    .replace(/(\d)[٫,](\d)/g, "$1.$2")
    .replace(/[^\p{L}\p{N}.\/×x+\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/** Tokens worth matching on (drops one-letter noise and stop words). */
const STOP = new Set(["و", "با", "به", "از", "در", "برای", "یه", "یک", "که", "را", "رو", "مدل", "می", "خوام", "میخوام", "لازم", "دارم"]);

export function tokenize(input: string): string[] {
  return normalizeFa(input)
    .split(" ")
    .filter((t) => t.length > 1 && !STOP.has(t));
}
