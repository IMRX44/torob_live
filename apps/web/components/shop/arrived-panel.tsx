"use client";
import Link from "next/link";
import { useState } from "react";
import { DoorClosed, PackageCheck, PackageX, Footprints } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import { useApp } from "@/lib/store";

/** The "I'm standing at the shop" panel: one tap reports reality and pulls up plan B. */
export function ArrivedPanel({ shopId, productId, lat, lon, name }: { shopId: string; productId: string | null; lat: number; lon: number; name: string }) {
  const { setOrigin, setFilters } = useApp();
  const [sent, setSent] = useState<null | "closed" | "unavailable" | "available">(null);
  const report = async (kind: "closed" | "unavailable" | "available") => {
    haptic([10, 30, 10]);
    setSent(kind);
    await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId, productId, kind }) });
    toast.success(kind === "available" ? "ممنون! به بقیه کمک کردی 🙌" : "ثبت شد؛ نزدیک‌ترین جایگزین باز را ببین");
  };
  return (
    <div className="mt-4 rounded-[24px] border border-line bg-elev p-4">
      <p className="flex items-center gap-1.5 text-[14px] font-bold">
        <Footprints className="size-4 text-brand" /> رسیدی دم مغازه؟
      </p>
      <p className="mt-0.5 text-[12px] text-muted">با یک لمس بگو چی شد؛ اگر نبود، همین الان جایگزین نزدیک را نشانت می‌دهم.</p>
      {sent && sent !== "available" ? (
        <Link
          href={productId ? `/p/${productId}` : "/"}
          className="mt-3 block"
          onClick={() => {
            setOrigin({ lat, lon, label: `کنار ${name}`, source: "map" });
            setFilters({ openOnArrival: true, mode: "walk", radiusKm: 1 });
          }}
        >
          <Button className="w-full" size="lg">
            جایگزین‌های باز در چند قدمی
          </Button>
        </Link>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={() => report("closed")} disabled={!!sent}>
            <DoorClosed className="size-4" /> بسته بود
          </Button>
          <Button variant="outline" onClick={() => report("unavailable")} disabled={!!sent || !productId}>
            <PackageX className="size-4" /> نداشت
          </Button>
          <Button variant="outline" onClick={() => report("available")} disabled={!!sent || !productId}>
            <PackageCheck className="size-4" /> داشت
          </Button>
        </div>
      )}
    </div>
  );
}
