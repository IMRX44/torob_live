"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowUp, CircleCheck, Cpu, HelpCircle, Lightbulb, Route, Store, TriangleAlert } from "lucide-react";
import { boardDdr, boardSocket, cpuBoardCompatible, formatToman, ramBoardCompatible, toPersianDigits } from "@torob/core";
import { ProductImage } from "@/components/cards/product-card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import type { ProductSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

type Slot = {
  key: string;
  label: string;
  optional: boolean;
  budget: number;
  status: "ok" | "over" | "missing";
  pick: ProductSummary | null;
  cheaper: ProductSummary | null;
  stepUp: ProductSummary | null;
};
type Build = { title: string; budget: number; purpose: string | null; slots: Slot[]; total: number; notes: string[] };
type Choice = "pick" | "cheaper" | "stepUp";

/**
 * A complete build (gaming PC, CCTV kit…) assembled from real listings: one product per part,
 * a running total against the budget, and one-tap cheaper / stronger swaps per part.
 */
export function BuildCard({ data }: { data: Build }) {
  const [choice, setChoice] = useState<Record<string, Choice>>({});
  const chosen = (s: Slot) => s[choice[s.key] ?? "pick"] ?? s.pick;
  const total = useMemo(() => data.slots.reduce((sum, s) => sum + (chosen(s)?.priceMin ?? 0), 0), [choice, data.slots]); // eslint-disable-line react-hooks/exhaustive-deps
  const pct = Math.min(130, Math.round((total / data.budget) * 100));
  const over = total > data.budget;
  // Live compatibility of the current choice (swaps can change it).
  const find = (re: RegExp, cat: string) => data.slots.find((s) => re.test(s.key) || re.test(s.label) || s.pick?.category === cat);
  const cpu = find(/cpu|پردازنده/i, "پردازنده");
  const board = find(/motherboard|mainboard|board|مادربرد/i, "مادربرد");
  const ram = find(/ram|memory|رم/i, "رم کامپیوتر");
  const cp = cpu ? chosen(cpu) : null;
  const bp = board ? chosen(board) : null;
  const rp = ram ? chosen(ram) : null;
  const cpuOk = cp && bp ? cpuBoardCompatible(cp.title, bp.title) : null;
  const ramOk = rp && bp ? ramBoardCompatible(rp.title, bp.title) : null;
  const socket = bp ? boardSocket(bp.title) : null;
  const ddr = bp ? boardDdr(bp.title) : null;

  const tripItems = data.slots
    .map((s) => ({ label: s.label, p: chosen(s) }))
    .filter((x) => x.p)
    .map((x) => `${x.label}~${x.p!.id}`)
    .join("|");

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 overflow-hidden rounded-[24px] border border-line bg-elev shadow-card">
      <div className="bg-gradient-to-bl from-fg to-[oklch(0.3_0.03_260)] p-4 text-bg">
        <p className="flex items-center gap-1.5 text-[12px] opacity-80">
          <Cpu className="size-4" /> سیستم پیشنهادی از قطعات موجود در مغازه‌ها
        </p>
        <h3 className="mt-1 text-lg font-black">{data.title}</h3>
        {data.purpose ? <p className="text-[12px] opacity-80">{data.purpose}</p> : null}
        <div className="mt-3 flex items-end justify-between text-[12px]">
          <span>
            جمع: <b className="text-[15px]">{formatToman(total)}</b>
          </span>
          <span className="opacity-80">بودجه {formatToman(data.budget)}</span>
        </div>
        <div className="mt-1.5 h-2 rounded-full bg-white/20">
          <div className={cn("h-2 rounded-full transition-all", over ? "bg-[oklch(0.7_0.18_27)]" : "bg-[oklch(0.75_0.15_158)]")} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <p className="mt-1 text-[11px] opacity-80">
          {over ? `${toPersianDigits(pct - 100)}٪ بالاتر از بودجه؛ برای بعضی قطعه‌ها «ارزان‌تر» را بزن` : `${formatToman(data.budget - total)} از بودجه باقی می‌ماند`}
        </p>
      </div>

      {cp && bp ? (
        <div
          className={cn(
            "flex items-start gap-2 border-b border-line px-3 py-2.5 text-[12px] leading-5",
            cpuOk === false || ramOk === false ? "bg-bad-soft" : cpuOk ? "bg-ok-soft" : "bg-warn-soft",
          )}
        >
          {cpuOk === false || ramOk === false ? (
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" />
          ) : cpuOk ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          ) : (
            <HelpCircle className="mt-0.5 size-4 shrink-0 text-warn" />
          )}
          <span>
            {cpuOk === false
              ? "پردازنده و مادربرد انتخابی با هم سازگار نیستند (سوکت متفاوت)."
              : cpuOk
                ? `پردازنده و مادربرد سازگارند${socket ? ` (سوکت ${socket})` : ""}.`
                : "سازگاری پردازنده و مادربرد از روی عنوان مشخص نیست؛ از فروشنده بپرسید."}
            {ramOk === false ? ` رم با مادربرد سازگار نیست${ddr ? ` (این مادربرد ${ddr} می‌خواهد)` : ""}.` : ramOk ? ` رم ${ddr ?? ""} هم درست است.` : ""}
          </span>
        </div>
      ) : null}

      <ul className="divide-y divide-line">
        {data.slots.map((s) => {
          const p = chosen(s);
          const c = choice[s.key] ?? "pick";
          return (
            <li key={s.key} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-bold text-muted">
                  {s.label}
                  {s.optional ? <span className="ms-1 font-normal text-subtle">(اختیاری)</span> : null}
                </p>
                <span className="text-[10px] text-subtle">سهم بودجه {formatToman(s.budget)}</span>
              </div>
              {p ? (
                <>
                  <Link href={`/p/${p.id}`} className="mt-1.5 flex items-center gap-2.5">
                    <ProductImage src={p.image} alt="" className="size-12 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-[13px] leading-5 font-semibold">{p.title}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Store className="size-3" />
                        {toPersianDigits(p.nearbySellers || p.sellerCount)} فروشنده{p.nearbySellers ? " نزدیک" : ""}
                        {s.status === "over" && c === "pick" ? <span className="ms-1 text-warn">بالاتر از سهم بودجه</span> : null}
                      </span>
                    </span>
                    <b className="shrink-0 text-[13px]">{formatToman(p.priceMin)}</b>
                  </Link>
                  {s.cheaper || s.stepUp ? (
                    <div className="mt-2 flex gap-1.5">
                      {(
                        [
                          ["cheaper", "ارزان‌تر", ArrowDown, s.cheaper],
                          ["pick", "پیشنهاد", null, s.pick],
                          ["stepUp", "قوی‌تر", ArrowUp, s.stepUp],
                        ] as const
                      ).map(([k, label, Icon, prod]) =>
                        prod ? (
                          <button
                            key={k}
                            onClick={() => (haptic(), setChoice((x) => ({ ...x, [s.key]: k })))}
                            className={cn(
                              "flex h-8 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition",
                              c === k ? "bg-fg text-bg" : "bg-sunken text-muted hover:text-fg",
                            )}
                          >
                            {Icon ? <Icon className="size-3.5" /> : null}
                            {label} {k !== "pick" ? <span className="font-normal opacity-80">{formatToman(prod.priceMin).replace(" تومان", "")}</span> : null}
                          </button>
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-1.5 flex items-center gap-1.5 rounded-xl bg-sunken px-3 py-2 text-[12px] text-muted">
                  <HelpCircle className="size-4" /> این قطعه در کالاهای ثبت‌شده مغازه‌ها پیدا نشد؛ حضوری بپرسید.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {data.notes.length ? (
        <div className="space-y-1.5 border-t border-line p-3">
          {data.notes.map((n) => (
            <p key={n} className="flex items-start gap-1.5 text-[12px] leading-5">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-warn" /> {n}
            </p>
          ))}
        </div>
      ) : null}

      <div className="border-t border-line p-3">
        <Link href={`/trip?items=${encodeURIComponent(tripItems)}`}>
          <Button className="w-full" disabled={!tripItems}>
            <Route className="size-4" /> همه قطعات را در یک سفر بخر
          </Button>
        </Link>
        <p className="mt-2 text-center text-[11px] text-subtle">قیمت‌ها «کمترین قیمت ثبت‌شده» است؛ سازگاری قطعات را از فروشنده هم بپرسید.</p>
      </div>
    </motion.div>
  );
}
