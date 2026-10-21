import type { Origin } from "./types";

/** Well-known Tehran places users type ("نزدیک ونک"), plus the dataset's dense districts. */
export const PLACES: { name: string; aliases: string[]; lat: number; lon: number }[] = [
  { name: "لاله‌زار", aliases: ["لاله زار", "لالهزار"], lat: 35.6967, lon: 51.4178 },
  { name: "خیابان جمهوری", aliases: ["جمهوری", "جمهوری اسلامی"], lat: 35.6958, lon: 51.4088 },
  { name: "پاساژ علاءالدین", aliases: ["علاالدین", "علادین", "علائدین", "علاءالدین"], lat: 35.6949, lon: 51.4071 },
  { name: "پاساژ چارسو", aliases: ["چارسو", "چهارسو"], lat: 35.6942, lon: 51.4133 },
  { name: "میدان فردوسی", aliases: ["فردوسی"], lat: 35.7006, lon: 51.4196 },
  { name: "بهارستان", aliases: ["بهارستان", "میدان بهارستان"], lat: 35.6918, lon: 51.4317 },
  { name: "میدان امام خمینی", aliases: ["توپخانه", "امام خمینی"], lat: 35.6866, lon: 51.4205 },
  { name: "بازار بزرگ", aliases: ["بازار", "بازار تهران"], lat: 35.6747, lon: 51.4217 },
  { name: "میدان انقلاب", aliases: ["انقلاب"], lat: 35.7009, lon: 51.3912 },
  { name: "میدان ولیعصر", aliases: ["ولیعصر", "ولی عصر"], lat: 35.7124, lon: 51.4071 },
  { name: "میدان هفت تیر", aliases: ["هفت تیر", "۷ تیر"], lat: 35.7158, lon: 51.4255 },
  { name: "ونک", aliases: ["ونک", "میدان ونک"], lat: 35.7576, lon: 51.4096 },
  { name: "تجریش", aliases: ["تجریش", "میدان تجریش"], lat: 35.8045, lon: 51.4335 },
  { name: "سعادت‌آباد", aliases: ["سعادت آباد", "سعادتآباد"], lat: 35.7797, lon: 51.3742 },
  { name: "میدان آزادی", aliases: ["آزادی"], lat: 35.6997, lon: 51.338 },
  { name: "پونک", aliases: ["پونک"], lat: 35.7612, lon: 51.3317 },
  { name: "میدان امام حسین", aliases: ["امام حسین"], lat: 35.7017, lon: 51.4452 },
  { name: "شریعتی", aliases: ["شریعتی"], lat: 35.739, lon: 51.4425 },
  { name: "میرداماد", aliases: ["میرداماد"], lat: 35.7605, lon: 51.4325 },
  { name: "جنت‌آباد", aliases: ["جنت آباد"], lat: 35.7495, lon: 51.3045 },
];

export const DEFAULT_ORIGIN: Origin = {
  lat: 35.7006,
  lon: 51.4128,
  label: "مرکز شهر (پیش‌فرض)",
  source: "default",
};

export function findPlace(text: string) {
  const t = text.replace(/‌/g, " ");
  let best: (typeof PLACES)[number] | null = null;
  let bestLen = 0;
  for (const p of PLACES) {
    for (const a of [p.name, ...p.aliases]) {
      if (t.includes(a) && a.length > bestLen) {
        best = p;
        bestLen = a.length;
      }
    }
  }
  return best ? { place: best, matched: bestLen } : null;
}
