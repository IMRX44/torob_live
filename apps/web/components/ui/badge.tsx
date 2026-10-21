import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-[color-mix(in_oklch,var(--warn)_70%,var(--fg))]",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  neutral: "bg-neutral-soft text-muted",
  brand: "bg-brand-soft text-brand",
};

export function Badge({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] leading-5 font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
