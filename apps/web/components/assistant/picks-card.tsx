"use client";
import { motion } from "motion/react";
import { HelpCircle, Wand2 } from "lucide-react";
import { ProductCard } from "@/components/cards/product-card";
import { Chip } from "@/components/ui/chip";
import type { PicksPayload } from "@/lib/agent/messages";

export function PicksCard({ data, onSend, interactive }: { data: PicksPayload; onSend: (t: string) => void; interactive: boolean }) {
  return (
    <div className="mt-3 space-y-3">
      {data.picks.length ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] border border-brand/20 bg-brand-soft/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-bold text-brand">
            <Wand2 className="size-4" /> پیشنهاد من
          </p>
          <div className="space-y-2">
            {data.picks.map((p, i) => (
              <ProductCard key={p.productId} p={p.product} label={p.label} reasons={p.reasons} index={i} layout="row" />
            ))}
          </div>
        </motion.div>
      ) : null}
      {data.question ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-[22px] border border-line bg-elev p-3.5">
          <p className="flex items-start gap-1.5 text-[14px] font-semibold">
            <HelpCircle className="mt-0.5 size-4 shrink-0 text-brand" /> {data.question.text}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {data.question.options.map((o) => (
              <Chip key={o} tone="brand" disabled={!interactive} onClick={() => onSend(o)}>
                {o}
              </Chip>
            ))}
            <Chip disabled={!interactive} onClick={() => onSend("مهم نیست، خودت بهترین‌ها رو بگو")}>مهم نیست</Chip>
          </div>
        </motion.div>
      ) : null}
      {interactive && data.followups.length ? (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {data.followups.map((f) => (
            <Chip key={f} onClick={() => onSend(f)}>
              {f}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
