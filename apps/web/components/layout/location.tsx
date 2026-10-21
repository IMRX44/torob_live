"use client";
import { useState } from "react";
import { ChevronDown, LocateFixed, MapPin, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { PLACES } from "@/lib/places";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

const inTehran = (lat: number, lon: number) => lat > 35.55 && lat < 35.85 && lon > 51.1 && lon < 51.65;

export function useLocate() {
  const setOrigin = useApp((s) => s.setOrigin);
  const [busy, setBusy] = useState(false);
  const locate = (onDone?: () => void) => {
    if (!("geolocation" in navigator)) {
      toast.error("مرورگر شما موقعیت‌یابی را پشتیبانی نمی‌کند");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBusy(false);
        const { latitude: lat, longitude: lon } = pos.coords;
        if (!inTehran(lat, lon)) {
          toast.warning("موقعیت شما خارج از تهران است؛ یکی از محله‌ها را انتخاب کنید.");
          return;
        }
        haptic();
        setOrigin({ lat, lon, label: "موقعیت فعلی من", source: "gps" });
        toast.success("موقعیت شما تنظیم شد");
        onDone?.();
      },
      () => {
        setBusy(false);
        toast.error("دسترسی به موقعیت داده نشد؛ از فهرست انتخاب کنید.");
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 60_000 },
    );
  };
  return { locate, busy };
}

export function LocationSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { origin, setOrigin } = useApp();
  const { locate, busy } = useLocate();
  const [q, setQ] = useState("");
  const list = PLACES.filter((p) => !q || p.name.includes(q) || p.aliases.some((a) => a.includes(q)));
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="از کجا راه می‌افتی؟" description="فاصله، زمان رسیدن و باز بودن مغازه‌ها با همین نقطه حساب می‌شود.">
      <Button className="w-full" size="lg" onClick={() => locate(() => onOpenChange(false))} loading={busy}>
        <LocateFixed className="size-5" /> استفاده از موقعیت فعلی من
      </Button>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجوی محله یا میدان…"
        className="mt-4 h-11 w-full rounded-2xl border border-line bg-sunken px-4 text-sm outline-none focus:border-brand"
      />
      <ul className="mt-3 divide-y divide-line">
        {list.map((p) => {
          const active = origin.label === p.name;
          return (
            <li key={p.name}>
              <button
                type="button"
                className={cn("flex w-full items-center gap-3 py-3 text-start text-sm", active && "font-bold text-brand")}
                onClick={() => {
                  haptic();
                  setOrigin({ lat: p.lat, lon: p.lon, label: p.name, source: "preset" });
                  onOpenChange(false);
                }}
              >
                <MapPin className="size-4 shrink-0 text-muted" />
                {p.name}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

export function LocationPill({ className }: { className?: string }) {
  const origin = useApp((s) => s.origin);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 max-w-[60vw] items-center gap-1.5 rounded-full border border-line bg-elev ps-3 pe-2.5 text-sm font-medium shadow-sm transition active:scale-95",
          origin.source === "default" && "animate-pulse-ring",
          className,
        )}
      >
        {origin.source === "gps" ? <Navigation className="size-4 text-brand" /> : <MapPin className="size-4 text-brand" />}
        <span className="truncate">{origin.label}</span>
        <ChevronDown className="size-4 text-muted" />
      </button>
      <LocationSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
