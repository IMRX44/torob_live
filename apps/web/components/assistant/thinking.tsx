"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const LINES = {
  searching: ["دارم بین ۲۲۶ هزار محصول می‌گردم…", "فروشنده‌های نزدیک را می‌شمارم…"],
  thinking: [
    "دارم مشخصات و قیمت‌ها را کنار هم می‌گذارم…",
    "می‌بینم کدام راحت‌تر حضوری پیدا می‌شود…",
    "تازگی قیمت‌ها را چک می‌کنم…",
    "دارم بهترین‌ها را برایت گلچین می‌کنم…",
  ],
};

/** Honest progress while the (slow) model works; instant results are already on screen. */
export function Thinking({ stage }: { stage: string | null }) {
  const lines = stage === "searching" ? LINES.searching : LINES.thinking;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const t = setInterval(() => setI((x) => (x + 1) % lines.length), 2600);
    return () => clearInterval(t);
  }, [lines]);
  return (
    <div className="mt-4 flex items-center gap-3" role="status" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2].map((k) => (
          <motion.span
            key={k}
            className="size-2 rounded-full bg-brand"
            animate={{ y: [0, -5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: k * 0.15 }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span key={lines[i]} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="text-[13px] text-muted">
          {lines[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
