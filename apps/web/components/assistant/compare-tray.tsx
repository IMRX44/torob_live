"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { GitCompareArrows, X } from "lucide-react";
import { toPersianDigits } from "@torob/core";
import { useApp } from "@/lib/store";

export function CompareTray() {
  const { compare, clearCompare } = useApp();
  return (
    <AnimatePresence>
      {compare.length ? (
        <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="mb-2 flex items-center gap-2 rounded-full border border-line bg-elev p-1.5 shadow-float">
          <div className="flex -space-x-2 space-x-reverse ps-1">
            {compare.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={c.id} src={c.image ?? ""} alt="" className="size-8 rounded-full border-2 border-elev bg-white object-contain" />
            ))}
          </div>
          <Link href="/compare" className="flex flex-1 items-center gap-1.5 text-[13px] font-semibold">
            <GitCompareArrows className="size-4 text-brand" />
            مقایسه {toPersianDigits(compare.length)} محصول {compare.length < 2 ? "(یکی دیگر اضافه کن)" : ""}
          </Link>
          <button onClick={clearCompare} aria-label="پاک کردن مقایسه" className="grid size-8 place-items-center rounded-full hover:bg-sunken">
            <X className="size-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
