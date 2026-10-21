"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { SpecRow } from "@/lib/types";
import { cn } from "@/lib/cn";

export function SpecsTable({ specs }: { specs: SpecRow[] }) {
  const [open, setOpen] = useState(false);
  if (!specs.length) return <p className="px-4 text-sm text-muted">مشخصات فنی برای این محصول ثبت نشده است.</p>;
  const shown = open ? specs : specs.slice(0, 8);
  const sections = new Map<string, SpecRow[]>();
  shown.forEach((s) => sections.set(s.section || "مشخصات", [...(sections.get(s.section || "مشخصات") ?? []), s]));
  return (
    <div className="mx-4 overflow-hidden rounded-[var(--radius-card)] border border-line bg-elev">
      {[...sections.entries()].map(([sec, rows]) => (
        <div key={sec}>
          <p className="bg-sunken px-4 py-2 text-xs font-bold text-muted">{sec}</p>
          <dl className="divide-y divide-line">
            {rows.map((r, k) => (
              <div key={r.key + k} className="grid grid-cols-[38%_1fr] gap-3 px-4 py-2.5 text-[13px]">
                <dt className="text-muted">{r.key}</dt>
                <dd className="font-medium break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {specs.length > 8 ? (
        <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-center gap-1 border-t border-line py-3 text-sm font-semibold text-brand">
          {open ? "کمتر" : `همه ${specs.length.toLocaleString("fa-IR")} مشخصه`}
          <ChevronDown className={cn("size-4 transition", open && "rotate-180")} />
        </button>
      ) : null}
    </div>
  );
}
