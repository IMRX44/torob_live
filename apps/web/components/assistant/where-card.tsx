"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Building2, CalendarClock, ChevronLeft, MapPinned, MessageCircleQuestion, TrainFront, Users } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatDistance, formatMinutes, formatToman, toPersianDigits } from "@torob/core";
import type { WherePayload } from "@/lib/agent/messages";
import { FreshnessBadge, HoursBadge } from "@/components/badges";
import { ProductImage } from "@/components/cards/product-card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import { LiveInquiry } from "./live-inquiry";

/** Instant answer to "where should I go?": the best hub, the top three sellers and a one-tap inquiry. */
export function WhereCard({ data }: { data: WherePayload }) {
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: data.product.id, shopIds: data.top.map((o) => o.shop.id), timeoutSec: 90 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      haptic([10, 40, 10]);
      setInquiryId(d.inquiry.id);
      toast.success("از ۳ فروشنده پرسیدم؛ جواب‌ها همین‌جا می‌آید");
    } catch (e) {
      toast.error((e as Error).message || "ارسال نشد");
    } finally {
      setBusy(false);
    }
  };
  const pct = data.hub ? Math.min(95, Math.round(data.hub.successChance * 100)) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 overflow-hidden rounded-[24px] border border-line bg-elev shadow-card">
      <Link href={`/p/${data.product.id}`} className="flex items-center gap-3 p-3">
        <ProductImage src={data.product.image} alt="" className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted">کجا برم؟</p>
          <p className="line-clamp-1 text-[13px] font-bold">{data.product.title}</p>
          <p className="text-[11px] text-muted">
            {toPersianDigits(data.total)} فروشنده، {toPersianDigits(data.openCount)} تا باز{data.visitLabel ? ` برای ${data.visitLabel}` : " موقع رسیدن"}
          </p>
        </div>
        <ChevronLeft className="size-4 text-muted" />
      </Link>

      {data.allClosed ? (
        <p className="mx-3 mb-2 rounded-xl bg-warn-soft px-3 py-1.5 text-[11px]">
          هیچ فروشنده‌ای موقع رسیدن باز نیست؛ ساعت باز شدنشان را ببینید یا زمان دیگری انتخاب کنید.
        </p>
      ) : null}
      {data.visitLabel ? (
        <p className="mx-3 mb-2 flex items-center gap-1.5 rounded-xl bg-info-soft px-3 py-1.5 text-[11px]">
          <CalendarClock className="size-3.5 text-info" /> ساعت کاری مغازه‌ها برای «{data.visitLabel}» بررسی شد
        </p>
      ) : null}

      {data.hub ? (
        <Link
          href={data.hub.mallId ? `/mall/${data.hub.mallId}?p=${data.product.id}` : `/p/${data.product.id}`}
          className="mx-3 mb-2 block rounded-[20px] bg-gradient-to-bl from-brand to-[oklch(0.5_0.19_15)] p-3.5 text-brand-fg"
        >
          <p className="flex items-center gap-1.5 text-[11px] opacity-90">
            <MapPinned className="size-4" /> پیشنهاد من: برو جایی که چند فروشنده کنار هم‌اند
          </p>
          <p className="mt-1 text-[16px] font-black">{data.hub.label}</p>
          <p className="text-[12px] opacity-90">
            <Users className="me-1 inline size-3.5" />
            {toPersianDigits(data.hub.sellerCount)} فروشنده، {toPersianDigits(data.hub.openCount)} باز، {formatDistance(data.hub.distanceM ?? 0)}، {formatMinutes(data.hub.etaMin ?? 0)}
          </p>
          {pct != null ? (
            <div className="mt-2">
              <div className="h-1.5 rounded-full bg-white/25">
                <div className="h-1.5 rounded-full bg-white" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-[11px] opacity-90">شانس دست‌خالی برنگشتن: {toPersianDigits(pct)}٪</p>
            </div>
          ) : null}
        </Link>
      ) : null}

      <ul className="divide-y divide-line border-t border-line">
        {data.top.map((o, i) => (
          <li key={o.shop.id}>
            <Link href={`/s/${o.shop.id}?p=${data.product.id}`} className="flex items-start gap-2.5 px-3 py-2.5">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-sunken text-[11px] font-bold">{toPersianDigits(i + 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{o.shop.name}</p>
                <p className="truncate text-[11px] text-muted">
                  <Building2 className="me-1 inline size-3" />
                  {[o.shop.mallName, floorLabel(o.shop.floor), o.shop.unit ? `واحد ${toPersianDigits(o.shop.unit)}` : null].filter(Boolean).join("، ") || o.shop.address}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <HoursBadge open={o.open} />
                  <FreshnessBadge freshness={o.freshness} changedAt={o.priceChangedAt} confirmation={o.confirmation} />
                </div>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[13px] font-bold">{o.price ? formatToman(o.price) : "بپرسید"}</p>
                <p className="text-[10px] text-muted">{formatDistance(o.distanceM ?? 0)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {data.trafficZone ? (
        <p className="flex items-center gap-1.5 border-t border-line px-3 py-2 text-[11px] text-muted">
          <TrainFront className="size-3.5 text-warn" /> داخل طرح ترافیک؛ مترو پیشنهاد می‌شود.
        </p>
      ) : null}

      <div className="border-t border-line p-3">
        {inquiryId ? (
          <LiveInquiry id={inquiryId} />
        ) : (
          <div className="flex gap-2">
            <Button className="flex-1" onClick={ask} loading={busy} disabled={!data.top.length}>
              <MessageCircleQuestion className="size-4" /> قبل از رفتن از این {toPersianDigits(data.top.length)} تا بپرس
            </Button>
            <Link href={`/p/${data.product.id}`}>
              <Button variant="secondary">همه</Button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}
