"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Building2, ChevronLeft, Search, X } from "lucide-react";
import { formatDistance, toPersianDigits } from "@torob/core";
import { LazyMap, type MapCircle } from "@/components/map";
import { LocationPill } from "@/components/layout/location";
import { useJson } from "@/lib/hooks/use-fetch";
import { useContextQuery } from "@/lib/hooks/use-context-query";
import { useApp } from "@/lib/store";
import type { MallSummary } from "@/lib/server/malls";

type All = { id: string; name: string; lat: number; lon: number; shop_count: number };

export function MapExplorer() {
  const router = useRouter();
  const qs = useContextQuery();
  const origin = useApp((s) => s.origin);
  const { data } = useJson<{ near: MallSummary[]; all: All[] }>(`/api/malls?${qs}`);
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const circles: MapCircle[] = useMemo(() => (data?.all ?? []).map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, label: m.name, count: m.shop_count })), [data]);
  const mall = data?.all.find((m) => m.id === picked);
  const focus = useMemo(() => (mall ? { lat: mall.lat, lon: mall.lon, zoom: 16.5 } : { lat: origin.lat, lon: origin.lon, zoom: 14.5 }), [mall, origin]);

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] lg:h-dvh">
      <LazyMap origin={origin} circles={circles} fitToPins={false} focus={focus} onCircleClick={(id) => setPicked(id)} />
      <div className="absolute inset-x-3 top-3 flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) {
              try {
                sessionStorage.removeItem("torob-chat-v1");
              } catch {}
              router.push(`/?q=${encodeURIComponent(q.trim())}`);
            }
          }}
        >
          <Search className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="دنبال چه کالایی هستی؟" className="h-11 w-full rounded-full border border-line bg-elev/95 ps-10 pe-4 text-sm shadow-card outline-none backdrop-blur focus:border-brand" />
        </form>
        <LocationPill className="h-11 shadow-card" />
      </div>

      <AnimatePresence>
        {mall ? (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} className="absolute inset-x-3 bottom-20 lg:bottom-4">
            <div className="flex items-center gap-3 rounded-[22px] border border-line bg-elev p-3 shadow-float">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
                <Building2 className="size-5" />
              </span>
              <Link href={`/mall/${mall.id}`} className="min-w-0 flex-1">
                <p className="truncate font-bold">{mall.name}</p>
                <p className="text-[12px] text-muted">{toPersianDigits(mall.shop_count)} فروشگاه، مشاهده طبقات</p>
              </Link>
              <button aria-label="بستن" onClick={() => setPicked(null)} className="grid size-8 place-items-center rounded-full hover:bg-sunken">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        ) : data?.near.length ? (
          <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="absolute inset-x-0 bottom-20 lg:bottom-4">
            <p className="mb-2 px-4 text-[12px] font-semibold text-fg drop-shadow">پاساژهای نزدیک {origin.label}</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-3 pb-1">
              {data.near.map((m) => (
                <button key={m.id} onClick={() => setPicked(m.id)} className="flex w-56 shrink-0 items-center gap-2 rounded-[20px] border border-line bg-elev p-2.5 text-start shadow-card">
                  <Building2 className="size-5 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{m.name}</b>
                    <span className="text-[11px] text-muted">
                      {toPersianDigits(m.shopCount)} مغازه، {formatDistance(m.distanceM ?? 0)}
                    </span>
                  </span>
                  <ChevronLeft className="size-4 text-muted" />
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
