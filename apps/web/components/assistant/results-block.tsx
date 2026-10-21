"use client";
import { useEffect, useRef, useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { toPersianDigits } from "@torob/core";
import { ProductCard } from "@/components/cards/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp, contextParams } from "@/lib/store";
import type { QuickResults } from "@/lib/agent/messages";
import type { ProductSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

const RELAXED: Record<string, string> = {
  installment: "فروشنده قسطی برای این کالا پیدا نشد؛ همه فروشنده‌ها را نشان می‌دهم.",
  radius: "در این شعاع پیدا نشد؛ کل شهر را گشتم.",
  budget: "در این بودجه پیدا نشد؛ نزدیک‌ترین گزینه‌ها بدون سقف قیمت.",
};

/**
 * Instant results that arrive before the AI finishes thinking. When it's the latest
 * block, changing a filter in the context bar re-runs the same search live.
 */
export function ResultsBlock({ data, live }: { data: QuickResults; live: boolean }) {
  const origin = useApp((s) => s.origin);
  const filters = useApp((s) => s.filters);
  const [items, setItems] = useState<ProductSummary[]>(data.items);
  const [relaxed, setRelaxed] = useState(data.relaxed);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (!live) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const c = new AbortController();
    setLoading(true);
    const p = contextParams(origin, filters);
    p.set("q", data.query);
    fetch(`/api/search?${p}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items);
        setRelaxed(d.relaxed ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => c.abort();
  }, [origin, filters, live, data.query]);

  const shown = expanded ? items : items.slice(0, 6);
  return (
    <div className="mt-2">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
        <Sparkles className="size-4 text-brand" />
        <span className="text-[12px] text-muted">
          {toPersianDigits(items.length)} نتیجه برای «{data.query || data.rawText}»
        </span>
        {data.intent.chips.map((c) => (
          <Badge key={c} tone="brand">{c}</Badge>
        ))}
      </div>
      {relaxed.length ? (
        <p className="mb-2 flex items-start gap-1.5 rounded-2xl bg-info-soft px-3 py-2 text-[12px] leading-5">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          {relaxed.map((r) => RELAXED[r]).join(" ")}
        </p>
      ) : null}
      {items.length ? (
        <>
          <div className={cn("grid grid-cols-2 gap-2.5 transition-opacity sm:grid-cols-3", loading && "opacity-50")}>
            {shown.map((p, i) => (
              <ProductCard key={p.id} p={p} index={i} />
            ))}
          </div>
          {items.length > 6 ? (
            <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setExpanded(!expanded)}>
              {expanded ? "کمتر" : `${toPersianDigits(items.length - 6)} نتیجه دیگر`}
            </Button>
          ) : null}
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-4 text-center text-sm text-muted">
          چیزی با این مشخصات در کاتالوگ پیدا نشد. یه جور دیگه بگو یا دسته را عوض کن.
        </p>
      )}
    </div>
  );
}
