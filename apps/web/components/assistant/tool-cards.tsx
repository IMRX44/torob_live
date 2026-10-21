"use client";
import Link from "next/link";
import { useState } from "react";
import { LiveInquiry } from "./live-inquiry";
import { motion } from "motion/react";
import { Building2, ChevronLeft, Clock, MapPinned, MessageCircleQuestion, Route, Send, TriangleAlert, Trophy } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatAgo, formatDistance, formatMinutes, formatToman, REASON_LABEL, toPersianDigits, type ReasonCode } from "@torob/core";
import { ProductImage } from "@/components/cards/product-card";
import { HoursBadge } from "@/components/badges";
import { PriceRange } from "@/components/badges/price";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import type { OpenInfo, ProductSummary, HubSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn("mt-3 rounded-[24px] border border-line bg-elev p-3.5 shadow-sm", className)}>
    {children}
  </motion.div>
);

export function ToolPending({ name }: { name: string }) {
  const label: Record<string, string> = {
    searchCatalog: "دارم دقیق‌تر در کاتالوگ می‌گردم…",
    present: "دارم بهترین‌ها را گلچین می‌کنم…",
    compareProducts: "دارم مشخصات را کنار هم می‌گذارم…",
    findShops: "دارم فروشنده‌های نزدیک را رتبه‌بندی می‌کنم…",
    proposeInquiry: "دارم پیام استعلام را آماده می‌کنم…",
    planTrip: "دارم کوتاه‌ترین مسیر خرید را می‌چینم…",
    suggestList: "دارم لیست خرید کامل را آماده می‌کنم…",
    myInquiries: "دارم جواب فروشنده‌ها را چک می‌کنم…",
  };
  return (
    <div className="mt-3 flex items-center gap-2 rounded-2xl bg-sunken px-3 py-2.5 text-[13px] text-muted">
      <span className="size-2 animate-ping rounded-full bg-brand" />
      {label[name] ?? "در حال انجام…"}
    </div>
  );
}

type CompactOffer = {
  shopId: string;
  name: string;
  mall: string | null;
  floor: number | null;
  unit: string | null;
  price: number | null;
  priceChangedAt: string | null;
  open: OpenInfo;
  distanceM: number;
  etaMin: number;
  installment: boolean;
  warranty: boolean;
  confirmed: boolean | null;
  reasons: ReasonCode[];
};

export function CompareCard({ data }: { data: { products: ProductSummary[]; rows: { key: string; values: (string | null)[]; differs: boolean }[] } }) {
  const [onlyDiff, setOnlyDiff] = useState(true);
  const rows = onlyDiff ? data.rows.filter((r) => r.differs) : data.rows;
  const cheapest = Math.min(...data.products.map((p) => p.priceMin ?? Infinity));
  const mostSellers = Math.max(...data.products.map((p) => p.sellerCount));
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <p className="text-[13px] font-bold">مقایسه کنار هم</p>
        <button className="text-[12px] text-brand" onClick={() => setOnlyDiff(!onlyDiff)}>
          {onlyDiff ? "نمایش همه ردیف‌ها" : "فقط تفاوت‌ها"}
        </button>
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <table className="mt-2 w-full min-w-[440px] text-[12px]">
          <thead>
            <tr>
              <th className="w-24" />
              {data.products.map((p) => (
                <th key={p.id} className="p-2 align-top font-normal">
                  <Link href={`/p/${p.id}`} className="block">
                    <ProductImage src={p.image} alt={p.title} className="mx-auto size-16" />
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 font-semibold">{p.title}</p>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <td className="p-2 text-muted">قیمت</td>
              {data.products.map((p) => (
                <td key={p.id} className={cn("p-2 text-center", p.priceMin === cheapest && "bg-ok-soft")}>
                  <PriceRange min={p.priceMin} max={p.priceMax} className="text-[11px]" />
                  {p.priceMin === cheapest ? <Trophy className="mx-auto mt-0.5 size-3.5 text-ok" /> : null}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 text-muted">فروشنده</td>
              {data.products.map((p) => (
                <td key={p.id} className={cn("p-2 text-center font-semibold", p.sellerCount === mostSellers && "bg-ok-soft")}>
                  {toPersianDigits(p.sellerCount)}
                  {p.nearbySellers != null ? <span className="block text-[10px] font-normal text-muted">{toPersianDigits(p.nearbySellers)} نزدیک</span> : null}
                </td>
              ))}
            </tr>
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="p-2 text-muted">{r.key}</td>
                {r.values.map((v, i) => (
                  <td key={i} className={cn("p-2 text-center", r.differs && "font-medium")}>
                    {v ?? <span className="text-subtle">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ShopsCard({ data }: { data: { product: { id: string; title: string; image: string | null }; total: number; top: CompactOffer[]; hub: HubSummary | null } }) {
  if (!data.top?.length) return <Card>فروشنده‌ای با شرایط فعلی پیدا نشد.</Card>;
  return (
    <Card>
      <p className="text-[13px] font-bold">
        بهترین فروشنده‌ها برای «{data.product.title}»
      </p>
      {data.hub && data.hub.sellerCount >= 3 ? (
        <Link href={data.hub.mallId ? `/mall/${data.hub.mallId}?p=${data.product.id}` : `/p/${data.product.id}`} className="mt-2 flex items-center gap-2 rounded-2xl bg-brand-soft p-2.5 text-[12px]">
          <MapPinned className="size-5 shrink-0 text-brand" />
          <span className="flex-1">
            <b>{data.hub.label}</b>: {toPersianDigits(data.hub.sellerCount)} فروشنده کنار هم، {toPersianDigits(data.hub.openCount)} تا باز
          </span>
          <ChevronLeft className="size-4" />
        </Link>
      ) : null}
      <ul className="mt-2 divide-y divide-line">
        {data.top.map((o, i) => (
          <li key={o.shopId}>
            <Link href={`/s/${o.shopId}?p=${data.product.id}`} className="flex items-start gap-2.5 py-2.5">
              <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-sunken text-[11px] font-bold">{toPersianDigits(i + 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{o.name}</p>
                <p className="truncate text-[11px] text-muted">
                  {[o.mall, floorLabel(o.floor), o.unit ? `واحد ${toPersianDigits(o.unit)}` : null].filter(Boolean).join("، ") || "—"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <HoursBadge open={o.open} />
                  {o.reasons.slice(0, 2).map((r) => (
                    <Badge key={r} tone="neutral">{REASON_LABEL[r]}</Badge>
                  ))}
                </div>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[13px] font-bold">{o.price ? formatToman(o.price) : "بپرسید"}</p>
                <p className="text-[10px] text-muted">{formatDistance(o.distanceM)}، {formatMinutes(o.etaMin)}</p>
                {o.priceChangedAt ? <p className="text-[10px] text-subtle">{formatAgo(o.priceChangedAt)}</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/p/${data.product.id}`}>
        <Button variant="secondary" className="mt-1 w-full">
          همه {toPersianDigits(data.total)} فروشنده و نقشه
        </Button>
      </Link>
    </Card>
  );
}

export function InquiryProposalCard({ data }: { data: { productId: string; productTitle: string; offers: CompactOffer[] } }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: data.productId, shopIds: data.offers.map((o) => o.shopId), timeoutSec: 90 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      haptic([10, 40, 10]);
      setSent(d.inquiry.id);
      toast.success("استعلام ارسال شد؛ جواب‌ها همین‌جا زنده می‌آیند");
    } catch (e) {
      toast.error((e as Error).message || "ارسال نشد");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        <MessageCircleQuestion className="size-4 text-brand" /> استعلام قیمت و موجودی «{data.productTitle}»
      </p>
      <ul className="mt-2 space-y-1.5">
        {data.offers.map((o) => (
          <li key={o.shopId} className="flex items-center justify-between rounded-xl bg-sunken px-3 py-2 text-[12px]">
            <span className="truncate font-medium">{o.name}</span>
            <span className="shrink-0 text-muted">{o.price ? formatToman(o.price) : "بدون قیمت"}</span>
          </li>
        ))}
      </ul>
      {sent ? (
        <LiveInquiry id={sent} />
      ) : (
        <Button className="mt-3 w-full" onClick={send} loading={busy} disabled={!data.offers.length}>
          <Send className="size-5" /> ارسال به {toPersianDigits(data.offers.length)} فروشنده
        </Button>
      )}
    </Card>
  );
}

type TripData = {
  stops: { shopId: string; name: string; mall: string | null; floor: number | null; unit: string | null; items: { label: string; title: string; price: number | null }[]; arriveAt: string; open: OpenInfo; warning: string | null; travelMin: number; travelMode: string }[];
  uncovered: string[];
  totalPrice: number;
  totalMinutes: number;
  trafficZone: boolean;
  items: string[];
};

export function TripCard({ data }: { data: TripData }) {
  const t = (iso: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return (
    <Card>
      <p className="flex items-center gap-1.5 text-[13px] font-bold">
        <Route className="size-4 text-brand" /> سفر خرید: {toPersianDigits(data.stops.length)} توقف، حدود {formatMinutes(data.totalMinutes)}
      </p>
      <ol className="relative mt-3 space-y-3 border-s-2 border-dashed border-line ps-4">
        {data.stops.map((s) => (
          <li key={s.shopId} className="relative">
            <span className="absolute -start-[23px] top-1 size-3 rounded-full border-2 border-elev bg-brand" />
            <p className="text-[11px] text-muted">
              <Clock className="me-1 inline size-3" />
              رسیدن {t(s.arriveAt)}، {formatMinutes(s.travelMin)} {s.travelMode === "walk" ? "پیاده" : "با ماشین"}
            </p>
            <Link href={`/s/${s.shopId}`} className="text-[13px] font-semibold">
              {s.name}
            </Link>
            <p className="text-[11px] text-muted">
              <Building2 className="me-1 inline size-3" />
              {[s.mall, floorLabel(s.floor), s.unit ? `واحد ${toPersianDigits(s.unit)}` : null].filter(Boolean).join("، ") || "—"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {s.items.map((it) => (
                <Badge key={it.label} tone="brand">
                  {it.label}: {it.price ? formatToman(it.price) : "بپرسید"}
                </Badge>
              ))}
            </div>
            {s.warning ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] text-warn">
                <TriangleAlert className="size-3.5" /> {s.warning}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {data.uncovered.length ? <p className="mt-2 text-[12px] text-bad">پیدا نشد: {data.uncovered.join("، ")}</p> : null}
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-sunken px-3 py-2 text-[12px]">
        <span>جمع تقریبی سبد</span>
        <b>{formatToman(data.totalPrice)}</b>
      </div>
      <Link href={`/trip?items=${encodeURIComponent(data.items.join("|"))}`}>
        <Button variant="secondary" className="mt-2 w-full">
          <Route className="size-4" /> باز کردن سفر روی نقشه
        </Button>
      </Link>
    </Card>
  );
}

type MyInq = { inquiries: { id: string; product: string | null; productId: string | null; targets: { shop: string; status: string; price: number | null }[] }[] };

export function MyInquiriesCard({ data }: { data: MyInq }) {
  if (!data.inquiries.length) return <Card>هنوز از فروشنده‌ای استعلام نگرفته‌اید.</Card>;
  return (
    <Card>
      <p className="mb-2 text-[13px] font-bold">استعلام‌های اخیر شما</p>
      {data.inquiries.slice(0, 2).map((i) => (
        <div key={i.id} className="mb-3 last:mb-0">
          <p className="line-clamp-1 text-[12px] text-muted">{i.product}</p>
          <LiveInquiry id={i.id} />
        </div>
      ))}
    </Card>
  );
}
