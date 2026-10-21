"use client";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-sm active:scale-[0.98]",
  secondary: "bg-sunken text-fg hover:bg-line active:scale-[0.98]",
  ghost: "text-fg hover:bg-sunken",
  outline: "border border-line-strong text-fg hover:bg-sunken bg-elev",
  danger: "bg-bad-soft text-bad hover:brightness-95",
  success: "bg-ok text-white hover:brightness-110 active:scale-[0.98]",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-xl",
  md: "h-11 px-4 text-sm gap-2 rounded-2xl",
  lg: "h-13 px-6 text-base gap-2 rounded-2xl",
  icon: "h-10 w-10 rounded-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium whitespace-nowrap transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children}
    </button>
  );
});
