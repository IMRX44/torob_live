"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Sparkles, Users, Navigation } from "lucide-react";
import { formatDistance, formatMinutes, formatToman, toPersianDigits } from "@torob/core";
import { Button } from "@/components/ui/button";
import type { HubSummary } from "@/lib/types";

/** "Go here: several sellers next to each other" — the anti-empty-handed card. */
export function HubCard({ hub, productId, onPick, primary }: { hub: HubSummary; productId: string; onPick?: () => void; primary?: boolean }) {
  // Never promise certainty: registered stock is not confirmed stock.
  const pct = Math.min(95, Math.round(hub.successChance * 100));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={
        primary
          ? "relative overflow-hidden rounded-[24px] bg-gradient-to-bl from-brand to-[oklch(0.5_0.19_15)] p-4 text-brand-fg shadow-float"
          : "rounded-[24px] border border-line bg-elev p-4 shadow-sm"
      }
    >
      {primary ? <div aria-hidden className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-white/10 blur-2xl" /> : null}
      <div className="flex items-center gap-2 text-xs font-semibold opacity-90">
        <Sparkles className="size-4" /> {primary ? "پیشنهاد هوشمند: برو جایی که چند فروشنده کنار هم‌اند" : "خوشه خرید"}
      </div>
      <h3 className="mt-2 text-lg font-black">{hub.label}</h3>
      <p className="mt-1 text-sm opacity-90">
        <Users className="me-1 inline size-4" />
        {toPersianDigits(hub.sellerCount)} فروشنده این کالا در چند قدمی هم، {toPersianDigits(hub.openCount)} تا باز
      </p>
      {hub.priceMin != null ? (
        <p className="mt-0.5 text-sm opacity-90">
          قیمت‌ها: {formatToman(hub.priceMin)}
          {hub.priceMax && hub.priceMax !== hub.priceMin ? ` تا ${formatToman(hub.priceMax)}` : ""}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className={primary ? "h-2 rounded-full bg-white/25" : "h-2 rounded-full bg-sunken"}>
            <div className={primary ? "h-2 rounded-full bg-white" : "h-2 rounded-full bg-ok"} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-[11px] opacity-90">شانس دست‌خالی برنگشتن: {toPersianDigits(pct)}٪</p>
        </div>
        {hub.distanceM != null ? (
          <span className="text-end text-[11px] opacity-90">
            {formatDistance(hub.distanceM)}
            <br />
            {formatMinutes(hub.etaMin ?? 0)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2">
        {hub.mallId ? (
          <Link href={`/mall/${hub.mallId}?p=${productId}`} className="flex-1">
            <Button variant={primary ? "secondary" : "primary"} className="w-full">
              مسیر داخل پاساژ
            </Button>
          </Link>
        ) : null}
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${hub.lat},${hub.lon}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1"
          onClick={onPick}
        >
          <Button variant={primary ? "outline" : "secondary"} className={primary ? "w-full border-white/40 bg-white/10 text-white hover:bg-white/20" : "w-full"}>
            <Navigation className="size-4" /> مسیریابی
          </Button>
        </a>
      </div>
    </motion.div>
  );
}
