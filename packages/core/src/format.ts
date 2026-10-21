import { toPersianDigits } from "./text";

/** "۴۲٫۵ میلیون تومان" style compact price. */
export function formatToman(price: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (price == null || !Number.isFinite(price)) return "بدون قیمت";
  const compact = opts.compact ?? true;
  if (compact && price >= 1_000_000_000) return `${trim(price / 1_000_000_000)} میلیارد تومان`;
  if (compact && price >= 1_000_000) return `${trim(price / 1_000_000)} میلیون تومان`;
  return `${toPersianDigits(price.toLocaleString("en-US")).replace(/,/g, "٬")} تومان`;
}

function trim(n: number): string {
  const v = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return toPersianDigits(String(v)).replace(".", "٫");
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${toPersianDigits(Math.max(10, Math.round(meters / 10) * 10))} متر`;
  return `${toPersianDigits((Math.round(meters / 100) / 10).toString()).replace(".", "٫")} کیلومتر`;
}

export function formatMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${toPersianDigits(m)} دقیقه`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${toPersianDigits(h)} ساعت و ${toPersianDigits(r)} دقیقه` : `${toPersianDigits(h)} ساعت`;
}

/** Relative Persian time: "۳ روز پیش". */
export function formatAgo(date: Date | string | null | undefined, now: Date = new Date()): string {
  if (!date) return "نامشخص";
  const d = typeof date === "string" ? new Date(date) : date;
  const sec = Math.max(0, (now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "همین الان";
  const min = sec / 60;
  if (min < 60) return `${toPersianDigits(Math.floor(min))} دقیقه پیش`;
  const h = min / 60;
  if (h < 24) return `${toPersianDigits(Math.floor(h))} ساعت پیش`;
  const days = h / 24;
  if (days < 30) return `${toPersianDigits(Math.floor(days))} روز پیش`;
  const months = days / 30;
  if (months < 12) return `${toPersianDigits(Math.floor(months))} ماه پیش`;
  return `${toPersianDigits(Math.floor(months / 12))} سال پیش`;
}

export function formatClock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return toPersianDigits(mm ? `${h}:${String(mm).padStart(2, "0")}` : String(h));
}
