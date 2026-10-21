"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Circle, ClipboardList, Lightbulb, Route } from "lucide-react";
import { formatToman, toPersianDigits } from "@torob/core";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

type Item = { label: string; qty?: string; why?: string; sample: { id: string; title: string; priceMin: number | null; sellers: number; nearby: number } | null };

/** A practical shopping list for project-style needs, ready to become a one-trip route. */
export function ListCard({ data }: { data: { title: string; items: Item[]; tip: string | null } }) {
  const [skip, setSkip] = useState<string[]>([]);
  const chosen = data.items.filter((i) => !skip.includes(i.label));
  const total = chosen.reduce((s, i) => s + (i.sample?.priceMin ?? 0), 0);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-[24px] border border-line bg-elev p-3.5 shadow-sm">
      <p className="flex items-center gap-1.5 text-[14px] font-bold">
        <ClipboardList className="size-4 text-brand" /> {data.title}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {data.items.map((it) => {
          const on = !skip.includes(it.label);
          return (
            <li key={it.label} className={cn("flex items-start gap-2.5 rounded-2xl p-2.5 transition", on ? "bg-sunken" : "opacity-50")}>
              <button aria-label={on ? "حذف از لیست" : "افزودن به لیست"} onClick={() => (haptic(), setSkip((s) => (on ? [...s, it.label] : s.filter((x) => x !== it.label))))}>
                {on ? <CheckCircle2 className="mt-0.5 size-5 text-ok" /> : <Circle className="mt-0.5 size-5 text-line-strong" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">
                  {it.label}
                  {it.qty ? <span className="ms-1.5 text-[11px] font-normal text-muted">، {it.qty}</span> : null}
                </p>
                {it.why ? <p className="text-[11px] leading-5 text-muted">{it.why}</p> : null}
                {it.sample ? (
                  <Link href={`/p/${it.sample.id}`} className="mt-0.5 block truncate text-[11px] text-brand">
                    {it.sample.priceMin ? `از ${formatToman(it.sample.priceMin)}` : "قیمت ثبت نشده"}، {toPersianDigits(it.sample.nearby || it.sample.sellers)} فروشنده
                  </Link>
                ) : (
                  <p className="text-[11px] text-subtle">در کاتالوگ پیدا نشد؛ حضوری بپرسید</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {data.tip ? (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-2xl bg-warn-soft p-2.5 text-[12px] leading-5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" /> {data.tip}
        </p>
      ) : null}
      <div className="mt-3 flex items-center justify-between text-[12px] text-muted">
        <span>{toPersianDigits(chosen.length)} قلم</span>
        {total ? <span>شروع قیمت‌ها حدود {formatToman(total)}</span> : null}
      </div>
      <Link href={`/trip?items=${encodeURIComponent(chosen.map((i) => i.label).join("|"))}`}>
        <Button className="mt-2 w-full" disabled={!chosen.length}>
          <Route className="size-4" /> همه را در یک سفر بخر (کمترین توقف)
        </Button>
      </Link>
    </motion.div>
  );
}
