"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { BellRing, Check, Clock, LogOut, PackageCheck, PackageX, Replace, Search, Store, Tag, Timer, X } from "lucide-react";
import { toast } from "sonner";
import { floorLabel, formatAgo, formatToman, toPersianDigits } from "@torob/core";
import type { SellerInboxItem } from "@/lib/inquiry-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { ProductImage } from "@/components/cards/product-card";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

type Shop = { id: string; name: string; mallName: string | null; floor: number | null; unit: string | null };

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.start();
    o.stop(ctx.currentTime + 0.35);
  } catch {}
}

const parseNum = (s: string) => Number(s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^\d]/g, ""));

export function SellerInbox({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "products" | "hours">("inbox");
  const [items, setItems] = useState<SellerInboxItem[] | null>(null);
  const known = useRef(new Set<string>());

  const load = useCallback(async (notify = false) => {
    const r = await fetch("/api/seller/inbox", { cache: "no-store" });
    if (r.status === 401) return router.push("/seller");
    const d = (await r.json()) as { items: SellerInboxItem[] };
    const fresh = d.items.filter((i) => !known.current.has(i.targetId));
    d.items.forEach((i) => known.current.add(i.targetId));
    setItems(d.items);
    if (notify && fresh.length) {
      beep();
      haptic([30, 60, 30]);
      toast(`استعلام تازه: ${fresh[0]!.productTitle ?? ""}`, { icon: <BellRing className="size-4 text-brand" /> });
    }
    const unseen = d.items.filter((i) => i.status === "pending").map((i) => i.targetId);
    if (unseen.length) fetch("/api/seller/seen", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetIds: unseen }) });
  }, [router]);

  useEffect(() => {
    load();
    const es = new EventSource("/api/events?scope=seller");
    es.onmessage = () => load(true);
    const poll = setInterval(() => load(true), 20_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load]);

  const open = items?.filter((i) => i.status === "pending" || i.status === "seen") ?? [];
  const done = items?.filter((i) => !(i.status === "pending" || i.status === "seen")) ?? [];

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand text-brand-fg">
            <Store className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-black">{shop.name}</h1>
            <p className="truncate text-[11px] text-muted">
              {[shop.mallName, floorLabel(shop.floor), shop.unit ? `واحد ${toPersianDigits(shop.unit)}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-[11px] font-semibold text-ok">
            <span className="size-2 animate-pulse rounded-full bg-ok" /> آنلاین
          </span>
          <button
            aria-label="خروج"
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken"
            onClick={async () => {
              await fetch("/api/seller/logout", { method: "POST" });
              router.push("/seller");
            }}
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <div className="flex gap-1 px-4 pb-2">
          {(
            [
              ["inbox", `استعلام‌ها${open.length ? ` (${toPersianDigits(open.length)})` : ""}`],
              ["products", "کالاهای من"],
              ["hours", "ساعت امروز"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("h-9 flex-1 rounded-xl text-[13px] font-semibold transition", tab === k ? "bg-fg text-bg" : "text-muted hover:bg-sunken")}>
              {l}
            </button>
          ))}
        </div>
      </header>

      {tab === "inbox" ? (
        <div className="space-y-3 px-4 pt-4">
          {items === null ? (
            [0, 1].map((i) => <div key={i} className="skeleton h-48 rounded-[24px]" />)
          ) : open.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line-strong p-8 text-center">
              <BellRing className="mx-auto size-10 text-subtle" />
              <p className="mt-2 font-bold">فعلاً استعلام تازه‌ای نیست</p>
              <p className="mt-1 text-sm text-muted">به محض اینکه مشتری بپرسد، با صدا و لرزش خبرتان می‌کنیم.</p>
            </div>
          ) : (
            <AnimatePresence>
              {open.map((it) => (
                <InquiryReply key={it.targetId} item={it} shopId={shop.id} onDone={() => load()} />
              ))}
            </AnimatePresence>
          )}
          {done.length ? (
            <div className="pt-4">
              <p className="mb-2 text-[13px] font-bold text-muted">پاسخ داده‌شده</p>
              <ul className="space-y-2">
                {done.slice(0, 15).map((it) => (
                  <li key={it.targetId} className="flex items-center gap-3 rounded-2xl bg-elev p-3 text-[12px]">
                    <StatusDot status={it.status} />
                    <span className="min-w-0 flex-1 truncate">{it.productTitle}</span>
                    <span className="text-subtle">{formatAgo(it.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : tab === "products" ? (
        <MyProducts />
      ) : (
        <TodayHours />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    available: ["bg-ok", "موجود"],
    price_changed: ["bg-ok", "قیمت جدید"],
    unavailable: ["bg-bad", "ندارم"],
    alternative: ["bg-info", "جایگزین"],
    timeout: ["bg-line-strong", "منقضی"],
  };
  const [c, l] = map[status] ?? ["bg-line-strong", status];
  return (
    <span className="flex items-center gap-1.5 font-semibold">
      <span className={cn("size-2 rounded-full", c)} />
      {l}
    </span>
  );
}

function Countdown({ deadline }: { deadline: string }) {
  const [left, setLeft] = useState(() => new Date(deadline).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => setLeft(new Date(deadline).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (left <= 0) return <Badge tone="neutral">مشتری منتظر جایگزین است</Badge>;
  const s = Math.ceil(left / 1000);
  return (
    <Badge tone={s < 30 ? "bad" : "warn"} icon={<Timer className="size-3" />}>
      {toPersianDigits(Math.floor(s / 60))}:{toPersianDigits(String(s % 60).padStart(2, "0"))} برای جواب
    </Badge>
  );
}

function InquiryReply({ item, shopId, onDone }: { item: SellerInboxItem; shopId: string; onDone: () => void }) {
  const [mode, setMode] = useState<null | "price" | "alt">(null);
  const [price, setPrice] = useState("");
  const [hold, setHold] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  void shopId;

  const reply = async (body: Record<string, unknown>) => {
    setBusy(true);
    haptic(12);
    const r = await fetch("/api/seller/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: item.targetId, holdMinutes: hold, ...body }),
    });
    setBusy(false);
    if (!r.ok) return toast.error("ثبت نشد");
    toast.success("جواب شما برای مشتری ارسال شد");
    onDone();
  };

  return (
    <motion.article layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, x: 60 }} className="rounded-[24px] border border-brand/30 bg-elev p-4 shadow-card">
      <div className="flex items-start gap-3">
        <ProductImage src={item.productImage} alt={item.productTitle ?? ""} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Countdown deadline={item.deadline} />
            <span className="text-[11px] text-subtle">{formatAgo(item.createdAt)}</span>
          </div>
          <h3 className="mt-1 line-clamp-2 text-[14px] leading-6 font-bold">{item.productTitle}</h3>
          <p className="text-[12px] text-muted">قیمت ثبت‌شده شما: {item.listedPrice ? formatToman(item.listedPrice) : "ثبت نشده"}</p>
        </div>
      </div>
      <p className="mt-3 rounded-2xl bg-sunken p-3 text-[13px] leading-6">«{item.message}»</p>

      <p className="mt-3 mb-1.5 text-[12px] font-semibold text-muted">نگه‌داشتن برای مشتری (اختیاری)</p>
      <div className="flex flex-wrap gap-1.5">
        {[30, 60, 120].map((m) => (
          <Chip key={m} active={hold === m} onClick={() => setHold(hold === m ? null : m)} className="h-8">
            <Clock className="size-3.5" /> {toPersianDigits(m)} دقیقه
          </Chip>
        ))}
      </div>

      {mode === "price" ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = parseNum(price);
            if (n > 0) reply({ status: "price_changed", price: n });
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="قیمت جدید به تومان"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-line bg-sunken px-4 text-base outline-none focus:border-brand"
          />
          <Button type="submit" size="lg" loading={busy}>
            ثبت
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => setMode(null)} aria-label="انصراف">
            <X className="size-5" />
          </Button>
        </form>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="success" size="lg" loading={busy} onClick={() => reply({ status: "available", price: item.listedPrice })}>
            <PackageCheck className="size-5" /> موجوده، همین قیمت
          </Button>
          <Button variant="outline" size="lg" onClick={() => setMode("price")}>
            <Tag className="size-5" /> قیمت جدید
          </Button>
          <Button variant="outline" size="lg" onClick={() => setMode("alt")}>
            <Replace className="size-5" /> مدل مشابه دارم
          </Button>
          <Button variant="danger" size="lg" loading={busy} onClick={() => reply({ status: "unavailable" })}>
            <PackageX className="size-5" /> ندارم
          </Button>
        </div>
      )}
      <AltPicker open={mode === "alt"} onClose={() => setMode(null)} onPick={(p) => reply({ status: "alternative", altProductId: p.id, price: p.price, note: p.title })} />
    </motion.article>
  );
}

type MyProduct = { id: string; title: string; image: string | null; price: string | null; price_changed_at: string | null; confirmed_available: boolean | null; confirmed_price: string | null; confirmed_at: string | null };

function AltPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: { id: string; title: string; price: number | null }) => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MyProduct[]>([]);
  useEffect(() => {
    if (!open) return;
    const c = new AbortController();
    fetch(`/api/seller/products?q=${encodeURIComponent(q)}`, { signal: c.signal })
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
    return () => c.abort();
  }, [q, open]);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="کدام کالای مشابه را دارید؟" description="از کالاهای ثبت‌شده خودتان انتخاب کنید.">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در کالاهای من…" className="h-11 w-full rounded-2xl border border-line bg-sunken px-4 text-sm outline-none focus:border-brand" />
      <ul className="mt-3 divide-y divide-line">
        {items.map((p) => (
          <li key={p.id}>
            <button className="flex w-full items-center gap-3 py-2.5 text-start" onClick={() => onPick({ id: p.id, title: p.title, price: p.price ? Number(p.price) : null })}>
              <ProductImage src={p.image} alt="" className="size-12 shrink-0" />
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="line-clamp-2">{p.title}</span>
                <span className="text-[11px] text-muted">{p.price ? formatToman(Number(p.price)) : "بدون قیمت"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function MyProducts() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MyProduct[] | null>(null);
  const load = useCallback(() => {
    fetch(`/api/seller/products?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []));
  }, [q]);
  useEffect(load, [load]);
  const confirm = async (p: MyProduct, available: boolean) => {
    haptic();
    await fetch("/api/seller/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: p.id, available, price: p.price ? Number(p.price) : null }) });
    toast.success(available ? "موجودی تأیید شد؛ مشتری‌ها نشان «تأیید فروشنده» می‌بینند" : "ناموجود ثبت شد");
    load();
  };
  return (
    <div className="px-4 pt-4">
      <p className="mb-3 rounded-2xl bg-ok-soft p-3 text-[12px] leading-5">
        هر تأیید شما تا ۲۴ ساعت روی کارت مغازه‌تان «تأیید فروشنده» می‌خورد و در رتبه‌بندی بالاتر می‌آیید.
      </p>
      <label className="relative block">
        <Search className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در کالاهای من…" className="h-11 w-full rounded-2xl border border-line bg-elev ps-10 pe-4 text-sm outline-none focus:border-brand" />
      </label>
      <ul className="mt-3 space-y-2">
        {(items ?? []).map((p) => {
          const fresh = p.confirmed_at && Date.now() - new Date(p.confirmed_at).getTime() < 86_400_000;
          return (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-line bg-elev p-2.5">
              <ProductImage src={p.image} alt="" className="size-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[13px] font-medium">{p.title}</p>
                <p className="text-[11px] text-muted">
                  {p.price ? formatToman(Number(p.price)) : "بدون قیمت"} ·{" "}
                  {fresh ? (p.confirmed_available ? `تأیید شد ${formatAgo(p.confirmed_at)}` : "ناموجود اعلام شد") : `قیمت ${formatAgo(p.price_changed_at)}`}
                </p>
              </div>
              <button aria-label="موجود است" onClick={() => confirm(p, true)} className={cn("grid size-9 place-items-center rounded-xl", fresh && p.confirmed_available ? "bg-ok text-white" : "bg-ok-soft text-ok")}>
                <Check className="size-5" />
              </button>
              <button aria-label="ناموجود" onClick={() => confirm(p, false)} className={cn("grid size-9 place-items-center rounded-xl", fresh && p.confirmed_available === false ? "bg-bad text-white" : "bg-bad-soft text-bad")}>
                <X className="size-5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TodayHours() {
  const [close, setClose] = useState("19:00");
  const save = async (value: string | null, note?: string) => {
    haptic();
    await fetch("/api/seller/hours", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ close: value, note: note ?? null }) });
    toast.success(value ? `ثبت شد: امروز تا ${toPersianDigits(value)} هستید` : "امروز تعطیل اعلام شد");
  };
  return (
    <div className="px-4 pt-4">
      <p className="text-sm leading-6 text-muted">ساعت امروز را اعلام کنید تا مشتری بیهوده پشت در بسته نماند. این اعلام فقط برای امروز است.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {["14:00", "17:00", "19:00", "20:00", "21:00", "22:00"].map((t) => (
          <Button key={t} variant={close === t ? "primary" : "outline"} onClick={() => (setClose(t), save(t))}>
            تا {toPersianDigits(t)}
          </Button>
        ))}
      </div>
      <Button variant="danger" className="mt-3 w-full" onClick={() => save("00:00", "امروز تعطیل")}>
        امروز تعطیلم
      </Button>
    </div>
  );
}
