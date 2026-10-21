"use client";
import { useState } from "react";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { useJson } from "@/lib/hooks/use-fetch";
import { Skeleton } from "@/components/ui/skeleton";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

export function BuyingChecklist({ category }: { category: string }) {
  const { data, loading } = useJson<{ items: string[]; source: string }>(`/api/checklist?category=${encodeURIComponent(category)}`);
  const [done, setDone] = useState<number[]>([]);
  return (
    <div className="mx-4 rounded-[var(--radius-card)] border border-line bg-elev p-4">
      {loading && !data ? (
        <div className="space-y-3">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Sparkles className="size-4 animate-pulse text-brand" /> دارم چک‌لیست مخصوص «{category}» را آماده می‌کنم…
          </p>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-4" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {(data?.items ?? []).map((it, i) => {
            const on = done.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => (haptic(), setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i])))}
                  className="flex w-full items-start gap-2.5 text-start text-[13px] leading-6"
                >
                  {on ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" /> : <Circle className="mt-0.5 size-5 shrink-0 text-line-strong" />}
                  <span className={cn(on && "text-muted line-through")}>{it}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
