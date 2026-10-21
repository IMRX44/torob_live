"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Building2, Check, ChevronLeft, Footprints, Car, TrainFront, TriangleAlert, Layers } from "lucide-react";
import { floorLabel, formatDistance, formatMinutes, toPersianDigits } from "@torob/core";
import { FreshnessBadge, HoursBadge, PaymentBadges, ReasonChips, StockBadge, WarrantyBadge } from "@/components/badges";
import { FairPriceBar, Price } from "@/components/badges/price";
import { Badge } from "@/components/ui/badge";
import type { ShopOffer } from "@/lib/types";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/cn";

const MODE_ICON = { walk: Footprints, car: Car, metro: TrainFront };

export function ShopLocationLine({ shop }: { shop: ShopOffer["shop"] }) {
  const parts = [shop.mallName, floorLabel(shop.floor), shop.unit ? `واحد ${toPersianDigits(shop.unit)}` : null].filter(Boolean);
  if (!parts.length) return <p className="truncate text-xs text-muted">{shop.address}</p>;
  return (
    <p className="flex items-center gap-1 truncate text-xs text-muted">
      <Building2 className="size-3.5 shrink-0" />
      <span className="truncate">{parts.join(" · ")}</span>
    </p>
  );
}

export function ShopOfferCard({
  offer,
  stats,
  rank,
  selectable,
  selected,
  onSelect,
  productId,
}: {
  offer: ShopOffer;
  stats?: { min: number; max: number; median: number; count: number } | null;
  rank?: number;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  productId?: string;
}) {
  const mode = useApp((s) => s.filters.mode);
  const ModeIcon = MODE_ICON[mode];
  const unavailable = offer.confirmation && !offer.confirmation.available;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-[var(--radius-card)] border bg-elev p-3.5 shadow-sm transition",
        selected ? "border-brand ring-2 ring-brand/20" : "border-line",
        unavailable && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        {selectable ? (
          <button
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            aria-label="انتخاب برای استعلام"
            className={cn(
              "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border-2 transition active:scale-90",
              selected ? "border-brand bg-brand text-brand-fg" : "border-line-strong",
            )}
          >
            {selected ? <Check className="size-4" strokeWidth={3} /> : null}
          </button>
        ) : rank != null ? (
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-sunken text-xs font-bold text-muted">{toPersianDigits(rank)}</span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/s/${offer.shop.id}${productId ? `?p=${productId}` : ""}`} className="min-w-0">
              <h3 className="truncate text-[15px] font-bold">{offer.shop.name}</h3>
              <ShopLocationLine shop={offer.shop} />
            </Link>
            <div className="shrink-0 text-end">
              <Price value={offer.price} quality={offer.priceQuality} className="text-[15px]" struck={offer.confirmation?.price && offer.confirmation.price !== offer.price ? null : undefined} />
              {offer.distanceM != null ? (
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted">
                  <ModeIcon className="size-3.5" />
                  {formatDistance(offer.distanceM)} · {formatMinutes(offer.etaMin ?? 0)}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1">
            <HoursBadge open={offer.open} />
            <FreshnessBadge freshness={offer.freshness} changedAt={offer.priceChangedAt} confirmation={offer.confirmation} />
            <StockBadge offer={offer} />
            {offer.shop.payments.length ? <PaymentBadges payments={offer.shop.payments} compact /> : null}
            <WarrantyBadge warranty={offer.warranty} />
          </div>

          {offer.suspicious === "low" ? (
            <p className="mt-2 flex items-center gap-1.5 rounded-xl bg-warn-soft px-2.5 py-1.5 text-[11px] text-fg">
              <TriangleAlert className="size-3.5 shrink-0 text-warn" />
              خیلی ارزان‌تر از بقیه است؛ شاید قیمت قدیمی یا مدل متفاوت باشد. قبل از رفتن بپرسید.
            </p>
          ) : null}

          {stats ? <FairPriceBar price={offer.price} stats={stats} /> : null}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            <ReasonChips reasons={offer.reasons.filter((r) => !["closed", "category_only", "installment", "warranty"].includes(r))} max={3} />
            <div className="flex shrink-0 items-center gap-1">
              {offer.neighbours > 0 ? (
                <Badge tone="brand" icon={<Layers className="size-3" />}>+{toPersianDigits(offer.neighbours)} کنارش</Badge>
              ) : null}
              <Link href={`/s/${offer.shop.id}${productId ? `?p=${productId}` : ""}`} aria-label="جزئیات فروشگاه" className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken">
                <ChevronLeft className="size-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
