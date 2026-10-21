"use client";
import { GitCompareArrows } from "lucide-react";
import { useApp } from "@/lib/store";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";
import type { ProductSummary } from "@/lib/types";

export function CompareToggle({ product }: { product: ProductSummary }) {
  const { compare, toggleCompare } = useApp();
  const on = compare.some((c) => c.id === product.id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "حذف از مقایسه" : "افزودن به مقایسه"}
      onClick={() => (haptic(), toggleCompare({ id: product.id, title: product.title, image: product.image }))}
      className={cn("grid size-10 place-items-center rounded-full transition", on ? "bg-fg text-bg" : "hover:bg-sunken")}
    >
      <GitCompareArrows className="size-5" />
    </button>
  );
}
