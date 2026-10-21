"use client";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { List, Map as MapIcon, MessageCircleQuestion, TrainFront, HelpCircle, SearchX, Clock3 } from "lucide-react";
import { formatToman, toPersianDigits } from "@torob/core";
import { ShopOfferCard } from "@/components/cards/shop-offer-card";
import { HubCard } from "@/components/cards/hub-card";
import { InquirySheet } from "@/components/inquiry/inquiry-sheet";
import { ContextBar } from "@/components/layout/context-bar";
import { LazyMap, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useJson } from "@/lib/hooks/use-fetch";
import { useContextQuery } from "@/lib/hooks/use-context-query";
import { useApp } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import type { ShopOffer, ShopsForProduct } from "@/lib/types";
import { cn } from "@/lib/cn";

function shortPrice(p: number | null) {
  if (p == null) return "؟";
  return formatToman(p).replace(" تومان", "").replace(" میلیون", "م").replace(" میلیارد", "B");
}

export function WhereToBuy({ productId, productTitle }: { productId: string; productTitle: string }) {
  const qs = useContextQuery();
  const { data, loading, error, reload } = useJson<ShopsForProduct>(`/api/products/${productId}/shops?${qs}`);
  const origin = useApp((s) => s.origin);
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);
  const [view, setView] = useState<"list" | "map">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  const offers = data?.offers ?? [];
  const openCount = offers.filter((o) => o.open.state === "open").length;
  const cheapest = offers.reduce<ShopOffer | null>((m, o) => (o.price != null && (!m || (m.price ?? Infinity) > o.price) ? o : m), null);
  const topHub = data?.hubs[0] && data.hubs[0].sellerCount >= 3 ? data.hubs[0] : null;

  const toggle = (id: string) => {
    haptic();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-5)));
  };
  const inquiryTargets = useMemo(() => {
    const all = [...offers, ...(data?.maybe ?? [])];
    if (selected.length) return all.filter((o) => selected.includes(o.shop.id));
    return offers.filter((o) => o.open.state !== "closed").slice(0, 3);
  }, [selected, offers, data?.maybe]);

  const pins: MapPin[] = useMemo(
    () =>
      offers.slice(0, 60).map((o) => ({
        id: o.shop.id,
        lat: o.shop.lat,
        lon: o.shop.lon,
        label: shortPrice(o.price),
        title: o.shop.name,
        tone: selected.includes(o.shop.id)
          ? "selected"
          : o.confirmation?.available
            ? "confirmed"
            : o.open.state === "open"
              ? "open"
              : o.open.state === "closed"
                ? "closed"
                : "unknown",
      })),
    [offers, selected],
  );
  const focused = offers.find((o) => o.shop.id === focusId) ?? null;

  return (
    <section className="mt-6" aria-labelledby="where">
      <div className="sticky top-14 z-20 border-b border-line/60 bg-bg/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 id="where" className="text-[17px] font-bold">کجا بخرم؟</h2>
          <div className="flex rounded-full bg-sunken p-1" role="tablist">
            {(
              [
                ["list", "فهرست", List],
                ["map", "نقشه", MapIcon],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => (haptic(), setView(v))}
                className={cn("flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold transition", view === v ? "bg-elev shadow-sm" : "text-muted")}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
        <ContextBar />
      </div>

      {loading && !data ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-44 rounded-[24px]" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : error ? (
        <div className="m-4 rounded-2xl bg-bad-soft p-4 text-sm">
          نتوانستم فروشنده‌ها را بیاورم: {error}
          <Button variant="outline" size="sm" className="ms-2" onClick={reload}>
            تلاش دوباره
          </Button>
        </div>
      ) : data ? (
        <div className={cn("transition-opacity", loading && "opacity-60")}>
          <p className="px-4 pt-3 text-[13px] text-muted">
            <b className="text-fg">{toPersianDigits(offers.length)}</b> فروشنده
            {filters.openOnArrival ? "" : `، ${toPersianDigits(openCount)} تا موقع رسیدن باز`}
            {cheapest ? `، ارزان‌ترین ${formatToman(cheapest.price)}` : ""}
            <span className="block text-[11px] text-subtle">زمان رسیدن و باز بودن از «{origin.label}» حساب شده</span>
          </p>

          {data.trafficZone && filters.mode === "car" ? (
            <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl bg-warn-soft p-3 text-[12px] leading-5">
              <TrainFront className="size-5 shrink-0 text-warn" />
              <span className="flex-1">این فروشنده‌ها داخل محدوده طرح ترافیک‌اند؛ با مترو راحت‌تر می‌رسید.</span>
              <Button size="sm" variant="outline" onClick={() => setFilters({ mode: "metro" })}>
                مترو
              </Button>
            </div>
          ) : null}

          {view === "map" ? (
            <div className="relative mx-4 mt-3 h-[62dvh] overflow-hidden rounded-[24px] border border-line">
              <LazyMap
                origin={origin}
                pins={pins}
                onPinClick={(id) => (haptic(), setFocusId(id))}
              />
              <AnimatePresence>
                {focused ? (
                  <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="absolute inset-x-2 bottom-2">
                    <ShopOfferCard offer={focused} stats={data.stats} selectable selected={selected.includes(focused.shop.id)} onSelect={() => toggle(focused.shop.id)} productId={productId} />
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-3 px-4 pt-3">
              {topHub ? <HubCard hub={topHub} productId={productId} primary /> : null}
              {data.hubs.length > 1 ? (
                <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
                  {data.hubs.slice(topHub ? 1 : 0, 4).map((h) => (
                    <div key={h.id} className="w-72 shrink-0">
                      <HubCard hub={h} productId={productId} />
                    </div>
                  ))}
                </div>
              ) : null}

              {offers.length === 0 ? (
                <EmptyOffers onRelax={() => setFilters({ radiusKm: null, maxPrice: null, minPrice: null, openOnArrival: false, installment: false, warranty: false, verifiedOnly: false, torobPayInPerson: false, fastDelivery: false })} />
              ) : (
                <>
                  <p className="flex items-center gap-1.5 pt-1 text-[12px] text-muted">
                    <MessageCircleQuestion className="size-4 text-brand" />
                    تیک بزنید تا قبل از رفتن از همان فروشنده‌ها بپرسم.
                  </p>
                  {(showAll ? offers : offers.slice(0, 8)).map((o, i) => (
                    <ShopOfferCard
                      key={o.shop.id}
                      offer={o}
                      stats={data.stats}
                      rank={i + 1}
                      selectable
                      selected={selected.includes(o.shop.id)}
                      onSelect={() => toggle(o.shop.id)}
                      productId={productId}
                    />
                  ))}
                  {offers.length > 8 && !showAll ? (
                    <Button variant="outline" className="w-full" onClick={() => setShowAll(true)}>
                      نمایش همه {toPersianDigits(offers.length)} فروشنده
                    </Button>
                  ) : null}
                </>
              )}

              {data.maybe.length ? (
                <div className="pt-4">
                  <h3 className="flex items-center gap-1.5 text-[15px] font-bold">
                    <HelpCircle className="size-4 text-muted" /> شاید داشته باشند؛ بپرسید
                  </h3>
                  <p className="mb-2 text-[12px] text-muted">این مغازه‌ها در همین صنف‌اند ولی این محصول را ثبت نکرده‌اند. صنف به‌تنهایی یعنی «موجود» نیست.</p>
                  <div className="space-y-3">
                    {data.maybe.slice(0, 4).map((o) => (
                      <ShopOfferCard key={o.shop.id} offer={o} selectable selected={selected.includes(o.shop.id)} onSelect={() => toggle(o.shop.id)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {/* Sticky action bar */}
      {data && (offers.length || data.maybe.length) ? (
        <div className="safe-bottom fixed inset-x-0 bottom-14 z-30 px-3 pb-2 lg:bottom-0">
          <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[22px] border border-line bg-elev/95 p-2 shadow-float backdrop-blur-xl">
            <div className="min-w-0 flex-1 ps-2 text-[12px] leading-4">
              {selected.length ? (
                <>
                  <b>{toPersianDigits(selected.length)}</b> فروشنده انتخاب شد
                  <button className="ms-2 text-brand" onClick={() => setSelected([])}>
                    لغو
                  </button>
                </>
              ) : (
                <span className="text-muted">
                  <Clock3 className="me-1 inline size-3.5" />
                  قیمت‌ها ممکن است قدیمی باشند
                </span>
              )}
            </div>
            <Button onClick={() => (haptic(), setSheet(true))} disabled={!inquiryTargets.length}>
              <MessageCircleQuestion className="size-5" />
              {selected.length ? "بپرس" : `از ${toPersianDigits(inquiryTargets.length)} فروشنده برتر بپرس`}
            </Button>
          </div>
        </div>
      ) : null}

      <InquirySheet open={sheet} onOpenChange={setSheet} productId={productId} productTitle={productTitle} offers={inquiryTargets} />
    </section>
  );
}

function EmptyOffers({ onRelax }: { onRelax: () => void }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line-strong p-6 text-center">
      <SearchX className="mx-auto size-10 text-subtle" />
      <p className="mt-2 font-bold">با این شرایط فروشنده‌ای پیدا نشد</p>
      <p className="mt-1 text-sm text-muted">فیلترها را کمی شل کنیم؟ پایین‌تر هم مغازه‌هایی که شاید داشته باشند آمده.</p>
      <Button className="mt-4" variant="outline" onClick={onRelax}>
        برداشتن فیلترها
      </Button>
    </div>
  );
}
