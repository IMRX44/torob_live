"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building2, Car, Clock, Footprints, Navigation, Plus, Route, Share2, TrainFront, TriangleAlert, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatDistance, formatMinutes, formatToman, toPersianDigits } from "@torob/core";
import type { TripResult } from "@/lib/server/trip";
import { PageHeader } from "@/components/layout/page-header";
import { LocationPill } from "@/components/layout/location";
import { HoursBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { LazyMap, type MapPin } from "@/components/map";
import { useApp } from "@/lib/store";
import { haptic } from "@/lib/haptic";

const PRESETS = [
  { name: "برق‌کشی یک واحد", items: ["سیم افشان ۲.۵", "کلید و پریز", "لامپ ال ای دی", "فیوز مینیاتوری"] },
  { name: "لوازم جانبی موبایل", items: ["شارژر آیفون", "گلس گوشی", "پاوربانک"] },
  { name: "دوربین مداربسته مغازه", items: ["دوربین مداربسته", "دی وی آر", "هارد اینترنال", "آداپتور"] },
];

const START = [
  { key: "now", label: "همین الان" },
  { key: "1h", label: "یک ساعت دیگر" },
  { key: "tomorrow", label: "فردا ساعت ۱۰" },
] as const;

function startDate(key: (typeof START)[number]["key"]) {
  const d = new Date();
  if (key === "1h") return new Date(d.getTime() + 3_600_000);
  if (key === "tomorrow") {
    // 10:00 Tehran tomorrow = 06:30 UTC
    const t = new Date(d.getTime() + 86_400_000);
    t.setUTCHours(6, 30, 0, 0);
    return t;
  }
  return d;
}

const time = (iso: string) => new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function TripPlanner({ initial }: { initial: string[] }) {
  const origin = useApp((s) => s.origin);
  const [items, setItems] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const [start, setStart] = useState<(typeof START)[number]["key"]>("now");
  const [trip, setTrip] = useState<TripResult | null>(null);
  const [busy, setBusy] = useState(false);

  const plan = async (list = items) => {
    if (list.length < 1) return;
    setBusy(true);
    haptic();
    try {
      const r = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: list.map((label) => ({ label })), origin, startAt: startDate(start).toISOString() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setTrip(d);
      window.history.replaceState(null, "", `/trip?items=${encodeURIComponent(list.join("|"))}`);
    } catch {
      toast.error("برنامه‌ریزی انجام نشد");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (initial.length) plan(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = () => {
    const t = draft.trim();
    if (t.length < 2 || items.includes(t)) return;
    haptic();
    setItems([...items, t].slice(0, 8));
    setDraft("");
  };

  const pins: MapPin[] = useMemo(
    () => (trip?.stops ?? []).map((s, i) => ({ id: s.shop.id, lat: s.shop.lat, lon: s.shop.lon, label: `${toPersianDigits(i + 1)}. ${s.shop.name}`, tone: "brand" })),
    [trip],
  );

  return (
    <>
      <PageHeader title="سفر خرید چندقلمی" subtitle="کمترین توقف، کوتاه‌ترین مسیر، با ساعت کاری" share={Boolean(trip)} />
      <div className="px-4 pt-4 pb-10">
        <div className="rounded-[24px] border border-line bg-elev p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-bold">لیست خرید</p>
            <LocationPill className="h-9" />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {items.map((it) => (
              <span key={it} className="inline-flex h-9 items-center gap-1 rounded-full bg-brand-soft ps-3.5 pe-1.5 text-[13px] font-medium text-brand">
                {it}
                <button aria-label={`حذف ${it}`} onClick={() => setItems(items.filter((x) => x !== it))} className="grid size-6 place-items-center rounded-full hover:bg-brand/10">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="یک قلم اضافه کن… مثلاً «پریز ارت‌دار»" className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-sunken px-4 text-sm outline-none focus:border-brand" />
            <Button type="submit" variant="secondary" size="icon" aria-label="افزودن">
              <Plus className="size-5" />
            </Button>
          </form>
          {!items.length ? (
            <div className="mt-3">
              <p className="mb-2 text-[12px] text-muted">یا یکی از سبدهای آماده:</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Chip key={p.name} tone="brand" onClick={() => setItems(p.items)}>
                    {p.name}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <p className="mt-4 mb-2 text-[12px] font-semibold text-muted">کی راه می‌افتی؟</p>
          <div className="flex flex-wrap gap-2">
            {START.map((s) => (
              <Chip key={s.key} active={start === s.key} onClick={() => setStart(s.key)}>
                <Clock className="size-3.5" /> {s.label}
              </Chip>
            ))}
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={() => plan()} loading={busy} disabled={!items.length}>
            <Wand2 className="size-5" /> بهترین مسیر را بچین
          </Button>
        </div>

        {trip ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["توقف", toPersianDigits(trip.stops.length)],
                ["زمان کل", formatMinutes(trip.totalMinutes)],
                ["جمع سبد", trip.totalPrice ? formatToman(trip.totalPrice) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-line bg-elev p-3">
                  <p className="text-[11px] text-muted">{k}</p>
                  <p className="mt-0.5 text-[13px] font-black">{v}</p>
                </div>
              ))}
            </div>
            {trip.trafficZone ? (
              <p className="mt-3 flex items-center gap-2 rounded-2xl bg-warn-soft p-3 text-[12px]">
                <TrainFront className="size-5 shrink-0 text-warn" /> مسیر داخل طرح ترافیک است؛ مترو یا پارکینگ عمومی را در نظر بگیرید.
              </p>
            ) : null}
            {trip.uncovered.length ? (
              <p className="mt-3 rounded-2xl bg-bad-soft p-3 text-[12px]">برای این اقلام فروشنده باز و نزدیکی پیدا نشد: {trip.uncovered.join("، ")}</p>
            ) : null}
            <div className="mt-3 h-64 overflow-hidden rounded-[24px] border border-line">
              <LazyMap origin={origin} pins={pins} />
            </div>

            <ol className="relative ms-3 mt-5 space-y-4 border-s-2 border-dashed border-line ps-5">
              <li className="relative">
                <span className="absolute -start-[29px] top-0.5 size-4 rounded-full border-4 border-elev bg-info" />
                <p className="text-[12px] text-muted">حرکت {time(trip.startAt)} از {trip.origin.label}</p>
              </li>
              {trip.stops.map((s, i) => (
                <li key={s.shop.id} className="relative">
                  <span className="absolute -start-[33px] top-1 grid size-6 place-items-center rounded-full bg-brand text-[11px] font-bold text-brand-fg">{toPersianDigits(i + 1)}</span>
                  <p className="flex items-center gap-1 text-[11px] text-muted">
                    {s.travelMode === "walk" ? <Footprints className="size-3.5" /> : <Car className="size-3.5" />}
                    {formatMinutes(s.travelMin)}، رسیدن {time(s.arriveAt)}
                  </p>
                  <div className="mt-1 rounded-[20px] border border-line bg-elev p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/s/${s.shop.id}`} className="min-w-0">
                        <p className="truncate text-[14px] font-bold">{s.shop.name}</p>
                        <p className="truncate text-[11px] text-muted">
                          <Building2 className="me-1 inline size-3" />
                          {[s.shop.mallName, floorLabel(s.shop.floor), s.shop.unit ? `واحد ${toPersianDigits(s.shop.unit)}` : null].filter(Boolean).join("، ") || s.shop.address}
                        </p>
                      </Link>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.shop.lat},${s.shop.lon}`} target="_blank" rel="noreferrer" aria-label="مسیریابی" className="grid size-9 shrink-0 place-items-center rounded-full bg-sunken">
                        <Navigation className="size-4" />
                      </a>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <HoursBadge open={s.open} />
                      {s.items.map((it) => (
                        <Link key={it.label} href={`/p/${it.productId}`}>
                          <Badge tone="brand">
                            {it.label}، {it.price ? formatToman(it.price) : "بپرسید"}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                    {s.warning ? (
                      <p className="mt-2 flex items-center gap-1 text-[11px] text-warn">
                        <TriangleAlert className="size-3.5" /> {s.warning}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
              <li className="relative">
                <span className="absolute -start-[29px] top-0.5 size-4 rounded-full border-4 border-elev bg-ok" />
                <p className="text-[12px] text-muted">
                  پایان حدود {time(trip.endAt)}، {formatDistance(trip.totalMeters)} جابه‌جایی
                </p>
              </li>
            </ol>
            <Button
              variant="outline"
              className="mt-5 w-full"
              onClick={async () => {
                const url = window.location.href;
                try {
                  if (navigator.share) await navigator.share({ url, title: "سفر خرید من" });
                  else {
                    await navigator.clipboard.writeText(url);
                    toast.success("لینک سفر کپی شد");
                  }
                } catch {}
              }}
            >
              <Share2 className="size-4" /> اشتراک سفر با دوست
            </Button>
          </motion.div>
        ) : !busy ? (
          <div className="mt-6 text-center text-[13px] text-muted">
            <Route className="mx-auto mb-2 size-10 text-subtle" />
            چند قلم اضافه کن تا بگویم از کدام مغازه‌ها و به چه ترتیبی بخری.
          </div>
        ) : null}
      </div>
    </>
  );
}
