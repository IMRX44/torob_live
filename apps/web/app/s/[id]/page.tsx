import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Building2, Globe, Instagram, Layers, MapPin, Phone, Store } from "lucide-react";
import { DAY_LABEL, WEEK_ORDER, floorLabel, formatClock, formatToman, formatAgo, tehranClock, toPersianDigits } from "@torob/core";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { FastBadge, HoursBadge, PaymentBadges } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { ProductImage } from "@/components/cards/product-card";
import { ArrivedPanel } from "@/components/shop/arrived-panel";
import { ShopMiniMap } from "@/components/shop/mini-map";
import { getShop, openInfo, shopCols, todayOverrides, toShop, type ShopRow } from "@/lib/server/catalog";
import { sql } from "@/lib/server/db";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const s = await getShop((await params).id);
  return { title: s?.name ?? "فروشگاه" };
}

export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const { id } = await params;
  const { p: productId } = await searchParams;
  const shop = await getShop(id);
  if (!shop) notFound();
  const now = new Date();
  const db = sql();
  const [overrides, offers, neighbours, focus] = await Promise.all([
    todayOverrides([id]),
    db<{ id: string; title: string; image: string | null; price: string | null; price_changed_at: Date | null }[]>`
      SELECT * FROM (
        SELECT DISTINCT ON (p.id) p.id, p.title, p.images[1] AS image, o.price, o.price_changed_at
        FROM offers o JOIN products p ON p.id = o.product_id
        WHERE o.shop_id = ${id} ORDER BY p.id, o.price NULLS LAST
      ) x ORDER BY price_changed_at DESC NULLS LAST LIMIT 30`,
    shop.mallId
      ? db<ShopRow[]>`SELECT ${shopCols()} FROM shops s WHERE s.mall_id = ${shop.mallId} AND s.id <> ${id}
          ORDER BY abs(coalesce(s.floor, 0) - ${shop.floor ?? 0}), s.unit LIMIT 8`
      : Promise.resolve([] as ShopRow[]),
    productId
      ? db<{ title: string; price: string | null; seller_title: string; price_changed_at: Date | null }[]>`
          SELECT p.title, o.price, o.seller_title, o.price_changed_at FROM offers o JOIN products p ON p.id = o.product_id
          WHERE o.shop_id = ${id} AND o.product_id = ${productId} LIMIT 1`
      : Promise.resolve([]),
  ]);
  const open = openInfo(shop, now, overrides.get(id));
  const today = tehranClock(now).day;
  const sameFloor = neighbours.filter((n) => n.floor === shop.floor).slice(0, 4);

  return (
    <AppShell>
      <PageHeader title={shop.name} subtitle={shop.mallName ?? shop.area ?? ""} share />
      <div className="px-4 pt-4 pb-28">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-[20px] bg-brand-soft text-brand">
            <Store className="size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black">{shop.name}</h1>
            {!shop.nameIsReal ? <p className="text-[11px] text-subtle">نام فروشگاه در دیتاست نمایشی است</p> : null}
            <div className="mt-1.5 flex flex-wrap gap-1">
              <HoursBadge open={open} />
              <FastBadge value={shop.fastDelivery} />
              {shop.offerCount ? <Badge tone="neutral">{toPersianDigits(shop.offerCount)} کالای ثبت‌شده</Badge> : <Badge tone="neutral">فقط صنف ثبت شده</Badge>}
            </div>
          </div>
        </div>

        {focus[0] ? (
          <div className="mt-4 rounded-[20px] border border-line bg-elev p-3">
            <p className="text-[11px] text-muted">کالایی که دنبالش هستید</p>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-semibold">{focus[0].seller_title || focus[0].title}</p>
            <p className="mt-1 flex items-center justify-between text-[13px]">
              <b>{focus[0].price ? formatToman(Number(focus[0].price)) : "قیمت ثبت نشده"}</b>
              <span className="text-[11px] text-muted">قیمت ثبت‌شده {formatAgo(focus[0].price_changed_at)} · موجودی تأیید نشده</span>
            </p>
          </div>
        ) : null}

        {/* Exact location inside the building: the #1 pain point after "is it open?" */}
        <div className="mt-4 overflow-hidden rounded-[24px] border border-line bg-elev">
          <div className="h-44">
            <ShopMiniMap lat={shop.lat} lon={shop.lon} label={shop.name} />
          </div>
          <div className="p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-bold">
              <MapPin className="size-4 text-brand" /> آدرس دقیق
            </p>
            <p className="mt-1 text-[13px] leading-6 text-muted">{shop.address}</p>
            {shop.mallName || shop.floor != null || shop.unit ? (
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["ساختمان", shop.mallName ?? "—"],
                  ["طبقه", floorLabel(shop.floor)?.replace("طبقه ", "") ?? "—"],
                  ["واحد/پلاک", shop.unit ? toPersianDigits(shop.unit) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-sunken p-2.5">
                    <p className="text-[10px] text-muted">{k}</p>
                    <p className="mt-0.5 truncate text-[13px] font-bold">{v}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {shop.mallName ? (
              <ol className="mt-3 space-y-1.5 text-[12px] leading-5">
                <li className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] text-brand-fg">۱</span>
                  وارد {shop.mallName} شوید.
                </li>
                <li className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] text-brand-fg">۲</span>
                  {shop.floor == null ? "طبقه در آدرس ثبت نشده؛ از نگهبان پاساژ بپرسید." : shop.floor === 0 ? "در همان طبقه همکف بمانید." : `به ${floorLabel(shop.floor)} بروید.`}
                </li>
                <li className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-[10px] text-brand-fg">۳</span>
                  {shop.unit ? `دنبال واحد/پلاک ${toPersianDigits(shop.unit)} بگردید.` : "شماره واحد ثبت نشده است."}
                  {sameFloor.length ? ` همسایه‌های همین طبقه: ${sameFloor.map((n) => `${n.name}${n.unit ? ` (${toPersianDigits(n.unit)})` : ""}`).join("، ")}.` : ""}
                </li>
              </ol>
            ) : null}
            <div className="mt-3 flex gap-2">
              <a className="flex-1" href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lon}`} target="_blank" rel="noreferrer">
                <span className="flex h-11 items-center justify-center gap-1.5 rounded-2xl bg-brand text-sm font-semibold text-brand-fg">مسیریابی</span>
              </a>
              <a className="flex-1" href={`https://neshan.org/maps/@${shop.lat},${shop.lon},17z`} target="_blank" rel="noreferrer">
                <span className="flex h-11 items-center justify-center rounded-2xl bg-sunken text-sm font-semibold">نشان</span>
              </a>
              <a className="flex-1" href={`https://balad.ir/location?latitude=${shop.lat}&longitude=${shop.lon}&zoom=17`} target="_blank" rel="noreferrer">
                <span className="flex h-11 items-center justify-center rounded-2xl bg-sunken text-sm font-semibold">بلد</span>
              </a>
            </div>
            {shop.mallId ? (
              <Link href={`/mall/${shop.mallId}${productId ? `?p=${productId}` : ""}`} className="mt-2 flex items-center justify-center gap-1.5 rounded-2xl border border-line py-2.5 text-[13px] font-semibold">
                <Layers className="size-4" /> نقشه طبقات و مغازه‌های {shop.mallName}
              </Link>
            ) : null}
          </div>
        </div>

        <ArrivedPanel shopId={shop.id} productId={productId ?? null} lat={shop.lat} lon={shop.lon} name={shop.name} />

        <Section title="ساعت کاری" className="mt-6 [&>div:first-child]:px-0">
          {shop.hours.known ? (
            <ul className="overflow-hidden rounded-[20px] border border-line bg-elev">
              {WEEK_ORDER.map((d) => {
                const shifts = shop.hours.days[d];
                return (
                  <li key={d} className={cn("flex justify-between px-4 py-2.5 text-[13px]", d === today && "bg-brand-soft font-bold")}>
                    <span>{DAY_LABEL[d]}{d === today ? " (امروز)" : ""}</span>
                    <span className="tabular">
                      {shifts === null ? "نامشخص" : shifts.length === 0 ? "تعطیل" : shifts.map((s) => `${formatClock(s.start)} تا ${formatClock(s.end)}`).join(" و ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-sunken p-3 text-[13px] text-muted">این فروشگاه ساعت کاری ثبت نکرده است؛ قبل از رفتن استعلام بگیرید.</p>
          )}
        </Section>

        <Section title="شرایط خرید" className="mt-6 [&>div:first-child]:px-0">
          <PaymentBadges payments={shop.payments} />
          <p className="mt-2 text-[11px] text-subtle">اطلاعات خرید قسطی را فروشنده اعلام کرده؛ «نوع پذیرش» نشان می‌دهد پذیرش حضوری صریحاً اعلام شده یا نه.</p>
        </Section>

        <Section title="راه‌های ارتباط" className="mt-6 [&>div:first-child]:px-0">
          <div className="space-y-2">
            {shop.phone ? (
              <p className="flex items-center gap-2 rounded-2xl bg-elev p-3 text-[13px]">
                <Phone className="size-4 text-muted" />
                <span className="tabular" dir="ltr">{shop.phone}</span>
                <Badge tone="neutral" className="ms-auto">شماره نمایشی دیتاست</Badge>
              </p>
            ) : null}
            {shop.instagram ? (
              <a href={shop.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-elev p-3 text-[13px]">
                <Instagram className="size-4 text-muted" /> صفحه اینستاگرام
              </a>
            ) : null}
            {shop.website ? (
              <a href={shop.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl bg-elev p-3 text-[13px]">
                <Globe className="size-4 text-muted" /> {shop.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ) : null}
          </div>
        </Section>

        {offers.length ? (
          <Section title="کالاهای ثبت‌شده" hint="تا ۳۰ کالا با آخرین تغییر قیمت" className="mt-6 [&>div:first-child]:px-0">
            <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-elev">
              {offers.map((o) => (
                <li key={o.id}>
                  <Link href={`/p/${o.id}`} className="flex items-center gap-3 p-2.5">
                    <ProductImage src={o.image} alt="" className="size-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-[13px]">{o.title}</span>
                      <span className="text-[11px] text-subtle">قیمت {formatAgo(o.price_changed_at)}</span>
                    </span>
                    <b className="shrink-0 text-[12px]">{o.price ? formatToman(Number(o.price)) : "—"}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {neighbours.length ? (
          <Section title={`همسایه‌ها در ${shop.mallName}`} className="mt-6 [&>div:first-child]:px-0">
            <ul className="grid grid-cols-2 gap-2">
              {neighbours.map((r) => {
                const n = toShop(r);
                return (
                  <li key={n.id}>
                    <Link href={`/s/${n.id}`} className="block rounded-2xl border border-line bg-elev p-2.5">
                      <p className="truncate text-[12px] font-semibold">{n.name}</p>
                      <p className="truncate text-[11px] text-muted">
                        <Building2 className="me-1 inline size-3" />
                        {[floorLabel(n.floor), n.unit ? toPersianDigits(n.unit) : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}
