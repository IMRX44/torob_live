"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { toPersianDigits } from "@torob/core";
import { useJson } from "@/lib/hooks/use-fetch";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/logo";

type Row = { id: string; name: string; mall_name: string | null; area: string | null; offer_count: number; pending: number };

export function SellerLogin() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, loading } = useJson<{ items: Row[] }>(`/api/seller/shops?q=${encodeURIComponent(q)}`);
  const login = async (id: string) => {
    const r = await fetch("/api/seller/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shopId: id }) });
    if (!r.ok) return toast.error("ورود ناموفق بود");
    router.push("/seller/inbox");
  };
  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-8 pb-10">
      <Logo />
      <h1 className="mt-8 text-2xl font-black">پنل فروشنده</h1>
      <p className="mt-1 text-sm leading-6 text-muted">
        مشتری‌ها قبل از آمدن، قیمت و موجودی را از شما می‌پرسند. با یک لمس جواب بدهید تا مشتری حضوری مطمئن به مغازه‌تان بیاید.
      </p>
      <p className="mt-3 rounded-2xl bg-info-soft p-3 text-[12px] leading-5">
        نسخه نمایشی: ورود با انتخاب فروشگاه انجام می‌شود (در نسخه واقعی با کد یک‌بارمصرف به شماره ثبت‌شده در ترب).
      </p>
      <label className="relative mt-5 block">
        <Search className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="نام فروشگاه یا پاساژ…"
          className="h-12 w-full rounded-2xl border border-line bg-elev ps-10 pe-4 text-sm outline-none focus:border-brand"
        />
      </label>
      <ul className="mt-4 space-y-2">
        {loading && !data
          ? Array.from({ length: 6 }, (_, i) => <li key={i} className="skeleton h-16 rounded-2xl" />)
          : data?.items.map((s) => (
              <li key={s.id}>
                <button onClick={() => login(s.id)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-elev p-3 text-start transition hover:shadow-card active:scale-[0.99]">
                  <span className="grid size-10 place-items-center rounded-xl bg-sunken text-muted">
                    <Store className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{s.name}</b>
                    <span className="block truncate text-[11px] text-muted">
                      {[s.mall_name, s.area].filter(Boolean).join(" · ")} · {toPersianDigits(s.offer_count)} کالا
                    </span>
                  </span>
                  {s.pending ? (
                    <Badge tone="brand" icon={<BellRing className="size-3" />}>
                      {toPersianDigits(s.pending)} استعلام
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))}
      </ul>
    </div>
  );
}
