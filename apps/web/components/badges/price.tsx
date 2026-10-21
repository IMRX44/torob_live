"use client";
import { formatToman, pricePosition } from "@torob/core";
import { cn } from "@/lib/cn";

export function Price({ value, quality, className, struck }: { value: number | null; quality?: string; className?: string; struck?: number | null }) {
  if (quality === "outlier") return <span className={cn("text-sm text-muted", className)}>قیمت نامعتبر ثبت شده</span>;
  if (value == null) return <span className={cn("text-sm text-muted", className)}>قیمت ثبت نشده · بپرسید</span>;
  return (
    <span className={cn("font-bold tabular", className)}>
      {formatToman(value)}
      {struck && struck !== value ? <s className="ms-2 text-xs font-normal text-subtle">{formatToman(struck)}</s> : null}
    </span>
  );
}

export function PriceRange({ min, max, className }: { min: number | null; max: number | null; className?: string }) {
  if (min == null) return <span className={cn("text-sm text-muted", className)}>قیمت ثبت نشده</span>;
  if (max == null || max === min) return <Price value={min} className={className} />;
  const short = (n: number) => formatToman(n).replace(" تومان", "");
  return (
    <span className={cn("font-bold tabular", className)}>
      {short(min)} <span className="font-normal text-muted">تا</span> {formatToman(max)}
    </span>
  );
}

/** Where a price sits between the cheapest and priciest seller. */
export function FairPriceBar({ price, stats }: { price: number | null; stats: { min: number; max: number; median: number; count: number } | null }) {
  if (price == null || !stats || stats.count < 2) return null;
  const pos = pricePosition(price, stats) ?? 0.5;
  const med = pricePosition(stats.median, stats) ?? 0.5;
  const label = pos <= 0.2 ? "از ارزان‌ترین‌ها" : pos >= 0.8 ? "گران‌تر از بیشتر فروشنده‌ها" : "قیمت معمول";
  return (
    <div className="mt-2" aria-label={`جایگاه قیمت: ${label}`}>
      <div className="relative h-1.5 rounded-full bg-gradient-to-l from-ok/60 via-warn/50 to-bad/50">
        <span className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded bg-fg/30" style={{ right: `${med * 100}%` }} />
        <span
          className="absolute top-1/2 size-3.5 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-elev bg-fg shadow"
          style={{ right: `${pos * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-subtle">
        <span>{formatToman(stats.min)}</span>
        <span className="font-medium text-muted">{label}</span>
        <span>{formatToman(stats.max)}</span>
      </div>
    </div>
  );
}
