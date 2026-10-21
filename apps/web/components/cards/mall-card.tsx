import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatDistance, toPersianDigits } from "@torob/core";
import type { MallSummary } from "@/lib/server/malls";

export function MallCard({ mall }: { mall: Pick<MallSummary, "id" | "name" | "area" | "shopCount" | "floors" | "topCategories" | "distanceM"> }) {
  return (
    <Link href={`/mall/${mall.id}`} className="block w-60 shrink-0 rounded-[var(--radius-card)] border border-line bg-elev p-3.5 shadow-sm transition hover:shadow-card active:scale-[0.98]">
      <div className="flex items-center gap-2.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{mall.name}</h3>
          <p className="text-[11px] text-muted">
            {mall.area ?? ""}
            {mall.distanceM != null ? ` · ${formatDistance(mall.distanceM)}` : ""}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-xs text-muted">
        {toPersianDigits(mall.shopCount)} فروشگاه · {toPersianDigits(mall.floors.length || 1)} طبقه
      </p>
      <p className="mt-1 line-clamp-1 text-[11px] text-subtle">{mall.topCategories.slice(0, 3).join("، ")}</p>
    </Link>
  );
}
