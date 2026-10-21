"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Check, Plus, Store, MapPin } from "lucide-react";
import { formatAgo, formatDistance, toPersianDigits } from "@torob/core";
import { PriceRange } from "@/components/badges/price";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import type { ProductSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

export function ProductImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-white", className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setBroken(true)} className="h-full w-full object-contain p-2 mix-blend-multiply" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-sunken text-subtle">
          <Store className="size-8" />
        </div>
      )}
    </div>
  );
}

export function ProductCard({ p, label, reasons, index = 0, layout = "grid" }: { p: ProductSummary; label?: string; reasons?: string[]; index?: number; layout?: "grid" | "row" }) {
  const { compare, toggleCompare } = useApp();
  const inCompare = compare.some((c) => c.id === p.id);
  const compareBtn = (
    <button
      type="button"
      aria-label={inCompare ? "حذف از مقایسه" : "افزودن به مقایسه"}
      onClick={(e) => {
        e.preventDefault();
        haptic();
        toggleCompare({ id: p.id, title: p.title, image: p.image });
      }}
      className={cn(
        "absolute top-2 left-2 z-10 grid size-8 place-items-center rounded-full border shadow-sm transition active:scale-90",
        inCompare ? "border-transparent bg-fg text-bg" : "border-line bg-elev/90 text-fg backdrop-blur",
      )}
    >
      {inCompare ? <Check className="size-4" /> : <Plus className="size-4" />}
    </button>
  );

  const meta = (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {p.nearbySellers != null ? (
        p.nearbySellers > 0 ? (
          <Badge tone="ok" icon={<MapPin className="size-3" />}>
            {toPersianDigits(p.nearbySellers)} فروشنده نزدیک{p.nearestM != null ? ` · ${formatDistance(p.nearestM)}` : ""}
          </Badge>
        ) : (
          <Badge tone="neutral">{toPersianDigits(p.sellerCount)} فروشنده در شهر</Badge>
        )
      ) : (
        <Badge tone="neutral" icon={<Store className="size-3" />}>{toPersianDigits(p.sellerCount)} فروشنده</Badge>
      )}
      {p.lastChange ? <span className="text-[10px] text-subtle">قیمت: {formatAgo(p.lastChange)}</span> : null}
    </div>
  );

  if (layout === "row") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
        <Link href={`/p/${p.id}`} className="relative flex gap-3 rounded-[var(--radius-card)] border border-line bg-elev p-2.5 shadow-sm transition hover:shadow-card active:scale-[0.99]">
          <ProductImage src={p.image} alt={p.title} className="size-24 shrink-0" />
          <div className="min-w-0 flex-1 py-0.5 pe-8">
            {label ? <Badge tone="brand" className="mb-1">{label}</Badge> : null}
            <h3 className="line-clamp-2 text-[13px] leading-5 font-semibold">{p.title}</h3>
            <PriceRange min={p.priceMin} max={p.priceMax} className="mt-1 block text-sm" />
            {meta}
            {reasons?.length ? (
              <ul className="mt-1.5 space-y-0.5 text-[11px] leading-4 text-muted">
                {reasons.slice(0, 3).map((r) => (
                  <li key={r} className="flex gap-1">
                    <Check className="mt-0.5 size-3 shrink-0 text-ok" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {compareBtn}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 8) * 0.035 }} className="h-full">
      <Link href={`/p/${p.id}`} className="relative flex h-full flex-col rounded-[var(--radius-card)] border border-line bg-elev p-2.5 shadow-sm transition hover:shadow-card active:scale-[0.98]">
        {compareBtn}
        <ProductImage src={p.image} alt={p.title} className="aspect-[5/4] w-full" />
        <div className="mt-2 flex flex-1 flex-col px-0.5">
          {label ? <Badge tone="brand" className="mb-1 self-start">{label}</Badge> : null}
          <h3 className="line-clamp-2 text-[13px] leading-5 font-semibold">{p.title}</h3>
          <div className="mt-auto pt-1.5">
            <PriceRange min={p.priceMin} max={p.priceMax} className="block text-[13px]" />
            {meta}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-elev p-2.5">
      <div className="skeleton aspect-[5/4] w-full rounded-2xl" />
      <div className="skeleton mt-3 h-3.5 w-11/12 rounded" />
      <div className="skeleton mt-2 h-3.5 w-2/3 rounded" />
      <div className="skeleton mt-3 h-4 w-1/2 rounded" />
    </div>
  );
}
