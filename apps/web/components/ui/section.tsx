import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({ title, action, children, className, hint }: { title: ReactNode; action?: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-7", className)}>
      <div className="mb-3 flex items-end justify-between gap-3 px-4">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
