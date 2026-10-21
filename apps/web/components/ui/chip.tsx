"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  tone?: "default" | "brand";
}

export function Chip({ active, icon, tone = "default", className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium whitespace-nowrap transition-all duration-150 active:scale-95",
        active
          ? "border-transparent bg-fg text-bg"
          : tone === "brand"
            ? "border-brand/25 bg-brand-soft text-brand hover:border-brand/50"
            : "border-line bg-elev text-fg hover:border-line-strong",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
