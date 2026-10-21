"use client";
import { useState } from "react";
import { Banknote, Car, Clock, CreditCard, Footprints, Radius, RotateCcw, ShieldCheck, SlidersHorizontal, TrainFront, Zap, BadgeCheck } from "lucide-react";
import { formatToman, toPersianDigits } from "@torob/core";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { DEFAULT_FILTERS, type Filters } from "@/lib/types";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";
import { LocationPill } from "./location";

const RADII = [0.5, 1, 2, 3, 5, 10];
const BUDGETS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000, 50_000_000];
const PRIORITY: { v: Filters["priority"]; label: string; hint: string }[] = [
  { v: "balanced", label: "متعادل", hint: "قیمت، فاصله، باز بودن و اطمینان با هم" },
  { v: "cheapest", label: "ارزان‌ترین", hint: "اول قیمت، بعد بقیه" },
  { v: "nearest", label: "نزدیک‌ترین", hint: "کمترین رفت‌وآمد" },
  { v: "surest", label: "مطمئن‌ترین", hint: "قیمت تازه، تأیید فروشنده، چند فروشنده کنار هم" },
];
const MODES: { v: Filters["mode"]; label: string; icon: typeof Car }[] = [
  { v: "car", label: "ماشین", icon: Car },
  { v: "walk", label: "پیاده", icon: Footprints },
  { v: "metro", label: "مترو", icon: TrainFront },
];

/**
 * The always-visible "what I want" bar: every chip changes results live, so users never
 * have to re-type their constraints.
 */
export function ContextBar({ className, showLocation = true }: { className?: string; showLocation?: boolean }) {
  const { filters, setFilters, resetFilters } = useApp();
  const [sheet, setSheet] = useState<null | "radius" | "budget" | "more">(null);
  const toggle = (k: keyof Filters) => {
    haptic();
    setFilters({ [k]: !filters[k] } as Partial<Filters>);
  };
  const changed = (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).filter((k) => filters[k] !== DEFAULT_FILTERS[k]).length;
  const ModeIcon = MODES.find((m) => m.v === filters.mode)!.icon;

  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto px-4 py-2", className)}>
      {showLocation ? <LocationPill className="h-9 shrink-0" /> : null}
      <Chip active={filters.radiusKm != null} icon={<Radius className="size-4" />} onClick={() => setSheet("radius")}>
        {filters.radiusKm != null ? `تا ${toPersianDigits(filters.radiusKm)} کیلومتر` : "کل شهر"}
      </Chip>
      <Chip active={filters.maxPrice != null || filters.minPrice != null} icon={<Banknote className="size-4" />} onClick={() => setSheet("budget")}>
        {filters.maxPrice != null ? `تا ${formatToman(filters.maxPrice)}` : filters.minPrice != null ? `از ${formatToman(filters.minPrice)}` : "بودجه"}
      </Chip>
      <Chip active={filters.openOnArrival} icon={<Clock className="size-4" />} onClick={() => toggle("openOnArrival")}>
        باز موقع رسیدن
      </Chip>
      <Chip active={filters.installment} icon={<CreditCard className="size-4" />} onClick={() => toggle("installment")}>
        خرید قسطی
      </Chip>
      <Chip active={filters.warranty} icon={<ShieldCheck className="size-4" />} onClick={() => toggle("warranty")}>
        گارانتی‌دار
      </Chip>
      <Chip active={filters.verifiedOnly} icon={<BadgeCheck className="size-4" />} onClick={() => toggle("verifiedOnly")}>
        فقط تأییدشده
      </Chip>
      <Chip active={filters.mode !== "car" || filters.priority !== "balanced" || filters.torobPayInPerson || filters.fastDelivery} icon={<SlidersHorizontal className="size-4" />} onClick={() => setSheet("more")}>
        <ModeIcon className="size-4" /> {PRIORITY.find((p) => p.v === filters.priority)!.label}
      </Chip>
      {changed > 0 ? (
        <Chip icon={<RotateCcw className="size-4" />} onClick={() => (haptic(), resetFilters())} className="text-muted">
          پاک کردن
        </Chip>
      ) : null}

      <Sheet open={sheet === "radius"} onOpenChange={(o) => !o && setSheet(null)} title="تا کجا حاضری بری؟" description="فقط فروشنده‌های داخل این شعاع نمایش داده می‌شوند.">
        <div className="grid grid-cols-3 gap-2">
          {RADII.map((r) => (
            <Button key={r} variant={filters.radiusKm === r ? "primary" : "outline"} onClick={() => (haptic(), setFilters({ radiusKm: r }), setSheet(null))}>
              {toPersianDigits(r)} کیلومتر
            </Button>
          ))}
          <Button className="col-span-3" variant={filters.radiusKm == null ? "primary" : "outline"} onClick={() => (setFilters({ radiusKm: null }), setSheet(null))}>
            مهم نیست، کل شهر
          </Button>
        </div>
      </Sheet>

      <BudgetSheet open={sheet === "budget"} onClose={() => setSheet(null)} />

      <Sheet open={sheet === "more"} onOpenChange={(o) => !o && setSheet(null)} title="اولویت و شرایط مراجعه">
        <p className="mb-2 text-sm font-semibold">چی برات مهم‌تره؟</p>
        <div className="grid grid-cols-2 gap-2">
          {PRIORITY.map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => (haptic(), setFilters({ priority: p.v }))}
              className={cn("rounded-2xl border p-3 text-start transition", filters.priority === p.v ? "border-brand bg-brand-soft" : "border-line bg-elev")}
            >
              <span className="block text-sm font-bold">{p.label}</span>
              <span className="mt-0.5 block text-[11px] leading-4 text-muted">{p.hint}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 mb-2 text-sm font-semibold">چطوری میری؟</p>
        <div className="grid grid-cols-3 gap-2">
          {MODES.map(({ v, label, icon: Icon }) => (
            <Button key={v} variant={filters.mode === v ? "primary" : "outline"} onClick={() => (haptic(), setFilters({ mode: v }))}>
              <Icon className="size-4" /> {label}
            </Button>
          ))}
        </div>
        <p className="mt-5 mb-2 text-sm font-semibold">شرایط خرید</p>
        <div className="flex flex-wrap gap-2">
          <Chip active={filters.torobPayInPerson} icon={<CreditCard className="size-4" />} onClick={() => toggle("torobPayInPerson")}>
            پذیرنده حضوری ترب‌پی
          </Chip>
          <Chip active={filters.fastDelivery} icon={<Zap className="size-4" />} onClick={() => toggle("fastDelivery")}>
            ارسال فوری
          </Chip>
        </div>
        <Button className="mt-6 w-full" onClick={() => setSheet(null)}>
          اعمال
        </Button>
      </Sheet>
    </div>
  );
}

function BudgetSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { filters, setFilters } = useApp();
  const [custom, setCustom] = useState("");
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="سقف بودجه‌ات چقدره؟" description="فروشنده‌هایی که قیمت ثبت‌شده‌شان بالاتر است کنار می‌روند.">
      <div className="grid grid-cols-2 gap-2">
        {BUDGETS.map((b) => (
          <Button key={b} variant={filters.maxPrice === b ? "primary" : "outline"} onClick={() => (haptic(), setFilters({ maxPrice: b, minPrice: null }), onClose())}>
            تا {formatToman(b)}
          </Button>
        ))}
        <Button variant={filters.maxPrice == null ? "primary" : "outline"} onClick={() => (setFilters({ maxPrice: null, minPrice: null }), onClose())}>
          محدودیت ندارم
        </Button>
      </div>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(custom.replace(/[^\d۰-۹]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
          if (n > 0) {
            setFilters({ maxPrice: n < 10_000 ? n * 1_000_000 : n, minPrice: null });
            onClose();
          }
        }}
      >
        <input
          inputMode="numeric"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="مبلغ دلخواه (مثلاً ۳ = ۳ میلیون)"
          className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-sunken px-4 text-sm outline-none focus:border-brand"
        />
        <Button type="submit" variant="secondary">ثبت</Button>
      </form>
    </Sheet>
  );
}
