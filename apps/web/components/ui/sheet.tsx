"use client";
import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bottom sheet used for every quick setting (filters, location, inquiry composer). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <Drawer.Content
          dir="rtl"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-elev shadow-float outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-2.5 mb-1 h-1.5 w-11 shrink-0 rounded-full bg-line-strong" />
          <div className="px-5 pt-2 pb-3">
            <Drawer.Title className="text-lg font-bold">{title}</Drawer.Title>
            {description ? <Drawer.Description className="mt-0.5 text-sm text-muted">{description}</Drawer.Description> : <Drawer.Description className="sr-only">{title}</Drawer.Description>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? <div className="safe-bottom border-t border-line px-5 pt-3">{footer}</div> : null}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
