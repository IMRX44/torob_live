"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building2, CheckCircle2, CircleSlash, Footprints, Navigation, Search, Sparkles, Store } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatToman, toPersianDigits } from "@torob/core";
import type { MallDetail } from "@/lib/server/malls";
import { HoursBadge } from "@/components/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ProductImage } from "@/components/cards/product-card";
import { LazyMap } from "@/components/map";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

type Shop = MallDetail["shops"][number];
const floorKey = (f: number | null) => (f == null ? "?" : String(f));
const floorName = (f: number | null) => (f == null ? "طبقه نامشخص" : (floorLabel(f) ?? ""));

export function MallView({ mall, product }: { mall: MallDetail; product: { id: string; title: string; image: string | null } | null }) {
  const sellers = useMemo(() => mall.shops.filter((s) => s.productHint), [mall.shops]);
  const [mode, setMode] = useState<"route" | "floors">(sellers.length ? "route" : "floors");
  const [q, setQ] = useState("");
  const [floor, setFloor] = useState<string>("all");
  const [checks, setChecks] = useState<Record<string, "has" | "no">>({});

  const floors = useMemo(() => {
    const m = new Map<string, Shop[]>();
    for (const s of mall.shops) m.set(floorKey(s.floor), [...(m.get(floorKey(s.floor)) ?? []), s]);
    return [...m.entries()].sort((a, b) => {
      const n = (k: string) => (k === "?" ? 999 : Number(k));
      return n(a[0]) - n(b[0]);
    });
  }, [mall.shops]);

  const filtered = (list: Shop[]) =>
    list.filter((s) => !q || s.name.includes(q) || s.categories.some((c) => c.includes(q)) || (s.unit ?? "").includes(q));

  const mark = async (s: Shop, v: "has" | "no") => {
    haptic();
    setChecks((c) => ({ ...c, [s.id]: v }));
    if (product) {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: s.id, productId: product.id, kind: v === "has" ? "available" : "unavailable" }),
      });
    }
    if (v === "has") toast.success("عالی! خریدت مبارک 🎉");
  };
  const next = sellers.find((s) => !checks[s.id] && s.open.state !== "closed");

  return (
    <div className="pb-24">
      <div className="h-40">
        <LazyMap pins={[{ id: mall.id, lat: mall.lat, lon: mall.lon, label: mall.name, tone: "brand" }]} fitToPins={false} focus={{ lat: mall.lat, lon: mall.lon, zoom: 16.5 }} />
      </div>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="neutral" icon={<Store className="size-3" />}>{toPersianDigits(mall.shopCount)} فروشگاه</Badge>
          <Badge tone="neutral" icon={<Building2 className="size-3" />}>{toPersianDigits(floors.length)} طبقه</Badge>
          {mall.topCategories.slice(0, 3).map((c) => (
            <Badge key={c} tone="info">{c}</Badge>
          ))}
        </div>
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${mall.lat},${mall.lon}`} target="_blank" rel="noreferrer" className="mt-3 block">
          <Button className="w-full">
            <Navigation className="size-4" /> مسیریابی تا {mall.name}
          </Button>
        </a>

        {product ? (
          <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-brand/25 bg-brand-soft/60 p-3">
            <ProductImage src={product.image} alt="" className="size-12 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-muted">دنبال</p>
              <p className="line-clamp-1 text-[13px] font-semibold">{product.title}</p>
              <p className="text-[12px] text-brand">{toPersianDigits(sellers.length)} مغازه در همین پاساژ ثبتش کرده‌اند</p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex rounded-full bg-sunken p-1">
          {sellers.length ? (
            <button onClick={() => setMode("route")} className={cn("h-9 flex-1 rounded-full text-[13px] font-semibold", mode === "route" ? "bg-elev shadow-sm" : "text-muted")}>
              <Footprints className="me-1 inline size-4" /> مسیر بازدید من
            </button>
          ) : null}
          <button onClick={() => setMode("floors")} className={cn("h-9 flex-1 rounded-full text-[13px] font-semibold", mode === "floors" ? "bg-elev shadow-sm" : "text-muted")}>
            <Building2 className="me-1 inline size-4" /> همه طبقات
          </button>
        </div>
      </div>

      {mode === "route" && sellers.length ? (
        <div className="px-4 pt-4">
          {next ? (
            <motion.div key={next.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mb-4 rounded-[22px] bg-fg p-4 text-bg">
              <p className="flex items-center gap-1.5 text-[12px] opacity-80">
                <Sparkles className="size-4" /> مقصد بعدی
              </p>
              <p className="mt-1 text-lg font-black">{next.name}</p>
              <p className="text-[13px] opacity-90">
                {floorName(next.floor)}
                {next.unit ? `، واحد ${toPersianDigits(next.unit)}` : ""}
                {next.productHint?.price ? `، ${formatToman(next.productHint.price)}` : ""}
              </p>
            </motion.div>
          ) : Object.values(checks).includes("has") ? null : (
            <p className="mb-4 rounded-2xl bg-warn-soft p-3 text-[13px]">
              همه مغازه‌های این پاساژ را دیدی. <Link className="font-bold text-brand" href={product ? `/p/${product.id}` : "/"}>جایگزین‌های نزدیک</Link>
            </p>
          )}
          <ol className="relative space-y-3 border-s-2 border-dashed border-line ps-5">
            {sellers.map((s, i) => {
              const c = checks[s.id];
              return (
                <li key={s.id} className="relative">
                  <span className={cn("absolute -start-[31px] top-3 grid size-5 place-items-center rounded-full text-[10px] font-bold", c === "has" ? "bg-ok text-white" : c === "no" ? "bg-bad text-white" : "bg-brand text-brand-fg")}>
                    {toPersianDigits(i + 1)}
                  </span>
                  <div className={cn("rounded-[20px] border bg-elev p-3", c ? "border-line opacity-70" : "border-line")}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/s/${s.id}${product ? `?p=${product.id}` : ""}`} className="min-w-0">
                        <p className="truncate text-[14px] font-bold">{s.name}</p>
                        <p className="text-[12px] text-muted">
                          {floorName(s.floor)}
                          {s.unit ? `، واحد ${toPersianDigits(s.unit)}` : ""}
                        </p>
                      </Link>
                      <b className="shrink-0 text-[13px]">{s.productHint?.price ? formatToman(s.productHint.price) : "بپرسید"}</b>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <HoursBadge open={s.open} />
                      <div className="flex gap-1.5">
                        <button onClick={() => mark(s, "has")} className={cn("flex h-8 items-center gap-1 rounded-xl px-2.5 text-[12px] font-semibold", c === "has" ? "bg-ok text-white" : "bg-ok-soft text-ok")}>
                          <CheckCircle2 className="size-4" /> داشت
                        </button>
                        <button onClick={() => mark(s, "no")} className={cn("flex h-8 items-center gap-1 rounded-xl px-2.5 text-[12px] font-semibold", c === "no" ? "bg-bad text-white" : "bg-bad-soft text-bad")}>
                          <CircleSlash className="size-4" /> نداشت
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-subtle">ترتیب: از همکف به بالا و بعد زیرزمین، تا کمترین بالا و پایین رفتن را داشته باشید. گزارش «داشت/نداشت» شما به خریداران بعدی کمک می‌کند.</p>
        </div>
      ) : (
        <div className="pt-3">
          <div className="sticky top-14 z-20 bg-bg/90 pt-1 pb-2 backdrop-blur-xl">
            <label className="relative mx-4 block">
              <Search className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم مغازه، صنف یا شماره واحد…" className="h-11 w-full rounded-2xl border border-line bg-elev ps-10 pe-4 text-sm outline-none focus:border-brand" />
            </label>
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4">
              <Chip active={floor === "all"} onClick={() => setFloor("all")}>همه</Chip>
              {floors.map(([k, list]) => (
                <Chip key={k} active={floor === k} onClick={() => setFloor(k)}>
                  {k === "?" ? "نامشخص" : floorName(Number(k))} <span className="text-[11px] opacity-70">{toPersianDigits(list.length)}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-5 px-4 pt-2">
            {floors
              .filter(([k]) => floor === "all" || floor === k)
              .map(([k, list]) => {
                const rows = filtered(list);
                if (!rows.length) return null;
                return (
                  <section key={k}>
                    <h3 className="mb-2 flex items-center gap-2 text-[14px] font-bold">
                      <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-fg px-1.5 text-[12px] text-bg">{k === "?" ? "؟" : toPersianDigits(k)}</span>
                      {k === "?" ? "طبقه نامشخص" : floorName(Number(k))}
                    </h3>
                    <ul className="grid grid-cols-2 gap-2">
                      {rows.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/s/${s.id}${product ? `?p=${product.id}` : ""}`}
                            className={cn("block h-full rounded-2xl border bg-elev p-2.5", s.productHint ? "border-brand/50 ring-1 ring-brand/20" : "border-line")}
                          >
                            <p className="truncate text-[12px] font-semibold">{s.name}</p>
                            <p className="truncate text-[11px] text-muted">{s.unit ? `واحد ${toPersianDigits(s.unit)}` : s.categories[0] ?? "—"}</p>
                            <p className="mt-1 text-[10px]">
                              <span className={s.open.state === "open" ? "text-ok" : s.open.state === "closed" ? "text-bad" : "text-subtle"}>
                                {s.open.state === "open" ? "باز" : s.open.state === "closed" ? "بسته" : "ساعت نامشخص"}
                              </span>
                              {s.productHint ? <span className="ms-1 font-bold text-brand">، {s.productHint.price ? formatToman(s.productHint.price) : "دارد"}</span> : null}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
