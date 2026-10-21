"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Building2, CircleSlash, Clock, Eye, Hourglass, Inbox, MessageCircleQuestion, Navigation, RefreshCw, Replace, Send, Sparkles, Store, Timer } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatAgo, formatDistance, formatToman, toPersianDigits } from "@torob/core";
import type { Inquiry, InquiryTarget, TargetStatus } from "@/lib/inquiry-types";
import { useInquiries, markInquiriesSeen } from "@/lib/hooks/use-inquiries";
import { useContextQuery } from "@/lib/hooks/use-context-query";
import { useJson } from "@/lib/hooks/use-fetch";
import { ProductImage, ProductCard } from "@/components/cards/product-card";
import { HoursBadge } from "@/components/badges";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { haptic } from "@/lib/haptic";
import type { ProductSummary, ShopOffer } from "@/lib/types";
import { cn } from "@/lib/cn";

const STATUS: Record<TargetStatus, { label: string; tone: Tone; icon: typeof Clock }> = {
  pending: { label: "ارسال شد، منتظر جواب", tone: "neutral", icon: Send },
  seen: { label: "فروشنده دید", tone: "info", icon: Eye },
  available: { label: "موجوده", tone: "ok", icon: BadgeCheck },
  price_changed: { label: "موجوده با قیمت جدید", tone: "ok", icon: BadgeCheck },
  unavailable: { label: "ندارد", tone: "bad", icon: CircleSlash },
  alternative: { label: "مدل مشابه دارد", tone: "info", icon: Replace },
  timeout: { label: "جواب نداد", tone: "warn", icon: Hourglass },
};

const isOk = (t: InquiryTarget) => t.status === "available" || t.status === "price_changed";
const isFinal = (t: InquiryTarget) => !["pending", "seen"].includes(t.status);

export function RequestsView({ focus }: { focus: string | null }) {
  const { items, refresh } = useInquiries();
  useEffect(() => {
    markInquiriesSeen();
  }, [items]);
  return (
    <>
      <PageHeader title="استعلام‌های من" subtitle="جواب فروشنده‌ها زنده همین‌جا می‌آید" />
      <div className="space-y-4 px-4 pt-4 pb-10">
        {items === null ? (
          [0, 1].map((i) => <div key={i} className="skeleton h-64 rounded-[24px]" />)
        ) : items.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-line-strong p-8 text-center">
            <Inbox className="mx-auto size-10 text-subtle" />
            <p className="mt-2 font-bold">هنوز از فروشنده‌ای نپرسیده‌اید</p>
            <p className="mt-1 text-sm text-muted">در صفحه هر محصول، فروشنده‌ها را تیک بزنید و «بپرس» را بزنید.</p>
            <Link href="/">
              <Button className="mt-4">شروع خرید</Button>
            </Link>
          </div>
        ) : (
          items.map((inq) => <InquiryCard key={inq.id} inq={inq} highlight={inq.id === focus} onChange={refresh} />)
        )}
      </div>
    </>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const [left, setLeft] = useState(() => new Date(deadline).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(deadline).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (left <= 0) return null;
  const s = Math.ceil(left / 1000);
  return (
    <span className="flex items-center gap-1 text-[11px] text-muted">
      <Timer className="size-3.5" />
      {toPersianDigits(Math.floor(s / 60))}:{toPersianDigits(String(s % 60).padStart(2, "0"))} تا پیشنهاد جایگزین
    </span>
  );
}

function InquiryCard({ inq, highlight, onChange }: { inq: Inquiry; highlight: boolean; onChange: () => void }) {
  const ok = inq.targets.filter(isOk).sort((a, b) => (a.replyPrice ?? a.listedPrice ?? Infinity) - (b.replyPrice ?? b.listedPrice ?? Infinity));
  const allFinal = inq.targets.every(isFinal);
  const needPlanB = allFinal && ok.length === 0;
  const best = ok[0];
  const [, force] = useState(0);
  // Re-render when the deadline passes so timeouts show up without waiting for the server.
  useEffect(() => {
    const ms = new Date(inq.deadline).getTime() - Date.now();
    if (ms > 0) {
      const t = setTimeout(() => {
        force((x) => x + 1);
        onChange();
      }, ms + 500);
      return () => clearTimeout(t);
    }
  }, [inq.deadline, onChange]);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("overflow-hidden rounded-[24px] border bg-elev shadow-sm", highlight ? "border-brand ring-2 ring-brand/15" : "border-line")}
    >
      <Link href={inq.productId ? `/p/${inq.productId}` : "#"} className="flex items-center gap-3 p-3.5">
        <ProductImage src={inq.productImage} alt="" className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[14px] leading-6 font-bold">{inq.productTitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-subtle">{formatAgo(inq.createdAt)}</span>
            {!allFinal ? <Countdown deadline={inq.deadline} /> : null}
          </div>
        </div>
      </Link>

      {best ? (
        <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-3.5 mb-3 rounded-[20px] bg-gradient-to-bl from-ok to-[oklch(0.5_0.13_165)] p-3.5 text-white">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold opacity-90">
            <Sparkles className="size-4" /> برو همین‌جا؛ فروشنده تأیید کرد
          </p>
          <p className="mt-1 text-[17px] font-black">{best.shopName}</p>
          <p className="text-[12px] opacity-90">
            <Building2 className="me-1 inline size-3.5" />
            {[best.mallName, floorLabel(best.floor), best.unit ? `واحد ${toPersianDigits(best.unit)}` : null].filter(Boolean).join(" · ") || "آدرس در صفحه فروشگاه"}
          </p>
          <p className="mt-1 text-[15px] font-bold">{formatToman(best.replyPrice ?? best.listedPrice)}</p>
          {best.holdUntil ? (
            <p className="mt-1 text-[12px]">
              <Clock className="me-1 inline size-3.5" />
              برایتان نگه داشته تا {new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(best.holdUntil))}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lon}`} target="_blank" rel="noreferrer" className="flex-1">
              <Button variant="secondary" className="w-full">
                <Navigation className="size-4" /> مسیریابی
              </Button>
            </a>
            <Link href={`/s/${best.shopId}${inq.productId ? `?p=${inq.productId}` : ""}`} className="flex-1">
              <Button variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20">
                آدرس دقیق
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : null}

      <ul className="divide-y divide-line border-t border-line">
        {inq.targets.map((t) => {
          const st = STATUS[t.status];
          const Icon = st.icon;
          return (
            <li key={t.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", t.status === "pending" ? "bg-sunken text-muted" : st.tone === "ok" ? "bg-ok-soft text-ok" : st.tone === "bad" ? "bg-bad-soft text-bad" : st.tone === "warn" ? "bg-warn-soft text-warn" : "bg-info-soft text-info")}>
                <Icon className={cn("size-4", t.status === "pending" && "animate-pulse")} />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/s/${t.shopId}`} className="block truncate text-[13px] font-semibold">
                  {t.shopName}
                </Link>
                <p className="truncate text-[11px] text-muted">
                  {st.label}
                  {t.replyPrice ? ` · ${formatToman(t.replyPrice)}` : ""}
                  {t.altProductTitle ? ` · ${t.altProductTitle}` : ""}
                  {t.repliedAt ? ` · ${formatAgo(t.repliedAt)}` : ""}
                </p>
              </div>
              {t.status === "alternative" && t.altProductId ? (
                <Link href={`/p/${t.altProductId}`}>
                  <Badge tone="info">دیدن مدل</Badge>
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {needPlanB || inq.targets.some((t) => t.status === "unavailable" || t.status === "timeout") ? <PlanB inq={inq} urgent={needPlanB} onSent={onChange} /> : null}
    </motion.article>
  );
}

/** Automatic alternatives when sellers don't answer or don't have the item. */
function PlanB({ inq, urgent, onSent }: { inq: Inquiry; urgent: boolean; onSent: () => void }) {
  const qs = useContextQuery();
  const { data, loading } = useJson<{ shops: ShopOffer[]; products: ProductSummary[] }>(`/api/inquiries/${inq.id}/alternatives?${qs}`);
  const [busy, setBusy] = useState(false);
  const askAll = async () => {
    if (!data?.shops.length || !inq.productId) return;
    setBusy(true);
    const r = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: inq.productId, shopIds: data.shops.map((s) => s.shop.id), timeoutSec: 90 }),
    });
    setBusy(false);
    if (r.ok) {
      haptic([10, 40, 10]);
      toast.success("از فروشنده‌های جایگزین هم پرسیدم");
      onSent();
    } else toast.error("ارسال نشد");
  };
  return (
    <div className={cn("border-t border-line p-3.5", urgent ? "bg-warn-soft/60" : "bg-sunken/50")}>
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        <RefreshCw className="size-4 text-brand" />
        {urgent ? "هیچ‌کدام تأیید نکردند؛ این‌ها الان باز و نزدیک‌اند" : "جایگزین‌های آماده"}
      </p>
      {loading && !data ? (
        <div className="skeleton mt-2 h-24 rounded-2xl" />
      ) : data?.shops.length ? (
        <>
          <ul className="mt-2 space-y-2">
            {data.shops.map((o) => (
              <li key={o.shop.id} className="flex items-center gap-2.5 rounded-2xl bg-elev p-2.5">
                <Store className="size-4 shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <Link href={`/s/${o.shop.id}${inq.productId ? `?p=${inq.productId}` : ""}`} className="block truncate text-[13px] font-semibold">
                    {o.shop.name}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <HoursBadge open={o.open} />
                    {o.distanceM != null ? <span className="text-[11px] text-muted">{formatDistance(o.distanceM)}</span> : null}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-bold">{o.price ? formatToman(o.price) : "بپرسید"}</span>
              </li>
            ))}
          </ul>
          <Button className="mt-2.5 w-full" onClick={askAll} loading={busy}>
            <MessageCircleQuestion className="size-4" /> از این {toPersianDigits(data.shops.length)} فروشنده هم بپرس
          </Button>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-muted">فروشنده باز دیگری برای همین مدل نزدیک شما نیست؛ مدل‌های مشابه را ببینید.</p>
      )}
      {data?.products.length ? (
        <>
          <p className="mt-4 mb-2 text-[12px] font-semibold text-muted">یا یک مدل مشابه:</p>
          <div className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5">
            {data.products.map((p) => (
              <div key={p.id} className="w-36 shrink-0">
                <ProductCard p={p} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
