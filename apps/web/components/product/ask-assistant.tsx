"use client";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const QUESTIONS = [
  "الان کجا برم که حتماً داشته باشه؟",
  "از کدوم فروشنده بخرم؟ چرا؟",
  "ارزش خریدش رو داره یا مدل بهتری هست؟",
  "قسطی کجا میده؟",
  "از فروشنده‌ها بپرس موجوده یا نه",
];

/** Consult the assistant about this exact product: it already knows the sellers, hubs and hours. */
export function AskAssistant({ productId }: { productId: string }) {
  return (
    <div className="mx-4 mt-5 rounded-[24px] border border-brand/20 bg-gradient-to-bl from-brand-soft/80 to-elev p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-bold">
        <Sparkles className="size-4 text-brand" /> با دستیار مشورت کن
      </p>
      <p className="mt-0.5 text-[12px] text-muted">فروشنده‌ها، خوشه‌ها، ساعت کاری و قیمت‌های همین کالا را می‌داند.</p>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
        {QUESTIONS.map((q) => (
          <Link
            key={q}
            href={`/?q=${encodeURIComponent(q)}&p=${productId}`}
            className="inline-flex h-9 shrink-0 items-center rounded-full border border-brand/25 bg-elev px-3.5 text-[13px] font-medium text-brand active:scale-95"
          >
            {q}
          </Link>
        ))}
      </div>
    </div>
  );
}
