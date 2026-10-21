"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

const DETAIL = {
  searching: ["دارم بین ۲۲۶ هزار محصول می‌گردم…", "فروشنده‌های نزدیک را می‌شمارم…"],
  thinking: [
    "دارم مشخصات و قیمت‌ها را کنار هم می‌گذارم…",
    "می‌بینم کدام راحت‌تر حضوری پیدا می‌شود…",
    "تازگی قیمت‌ها و ساعت کاری را چک می‌کنم…",
    "دارم بهترین‌ها را برایت گلچین می‌کنم…",
  ],
};

const STEPS = [
  { key: "searching", label: "جستجو در کالاها و مغازه‌ها" },
  { key: "thinking", label: "تحلیل و انتخاب هوشمند" },
] as const;

/** Honest, step-by-step progress while the (slow) model works; instant results are already on screen. */
export function Thinking({ stage }: { stage: string | null }) {
  const current = stage === "thinking" ? 1 : 0;
  const lines = current === 1 ? DETAIL.thinking : DETAIL.searching;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2600);
    return () => clearInterval(t);
  }, [lines]);
  return (
    <div className="ms-9 mt-3 rounded-2xl border border-line bg-elev px-3.5 py-3" role="status" aria-live="polite">
      <ol className="space-y-1.5">
        {STEPS.map((s, k) => {
          const done = k < current;
          const active = k === current;
          return (
            <li key={s.key} className={cn("flex items-center gap-2 text-[12.5px]", done ? "text-ok" : active ? "font-semibold text-fg" : "text-subtle")}>
              <span className={cn("grid size-4.5 place-items-center rounded-full", done ? "bg-ok text-white" : active ? "border-2 border-brand" : "border border-line-strong")}>
                {done ? <Check className="size-3" strokeWidth={3} /> : active ? <span className="size-1.5 animate-ping rounded-full bg-brand" /> : null}
              </span>
              {s.label}
            </li>
          );
        })}
      </ol>
      <AnimatePresence mode="wait">
        <motion.p key={lines[i]} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className="ms-6.5 mt-1.5 text-[11.5px] text-muted">
          {lines[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
