"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, CircleSlash, Eye, Hourglass, Navigation, Replace, Send } from "lucide-react";
import { formatToman, toPersianDigits } from "@torob/core";
import { useInquiries } from "@/lib/hooks/use-inquiries";
import type { TargetStatus } from "@/lib/inquiry-types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const ICON: Record<TargetStatus, typeof Send> = {
  pending: Send,
  seen: Eye,
  available: BadgeCheck,
  price_changed: BadgeCheck,
  unavailable: CircleSlash,
  alternative: Replace,
  timeout: Hourglass,
};
const LABEL: Record<TargetStatus, string> = {
  pending: "ارسال شد",
  seen: "دید، در حال جواب",
  available: "موجوده",
  price_changed: "موجوده، قیمت جدید",
  unavailable: "نداره",
  alternative: "مدل مشابه داره",
  timeout: "جواب نداد",
};

/** Inline, live status of an inquiry inside the chat: the conversation never has to leave the page. */
export function LiveInquiry({ id }: { id: string }) {
  const { items } = useInquiries();
  const inq = items?.find((i) => i.id === id);
  if (!inq) return <div className="skeleton mt-2 h-24 rounded-2xl" />;
  const ok = inq.targets.filter((t) => t.status === "available" || t.status === "price_changed");
  const best = ok.sort((a, b) => (a.replyPrice ?? a.listedPrice ?? 1e15) - (b.replyPrice ?? b.listedPrice ?? 1e15))[0];
  const done = inq.targets.every((t) => !["pending", "seen"].includes(t.status));
  return (
    <div className="mt-2 space-y-2">
      {best ? (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-[20px] bg-gradient-to-bl from-ok to-[oklch(0.5_0.13_165)] p-3.5 text-white">
          <p className="text-[12px] opacity-90">✅ فروشنده تأیید کرد؛ برو همین‌جا</p>
          <p className="mt-0.5 text-[16px] font-black">{best.shopName}</p>
          <p className="text-[12px] opacity-90">
            {best.mallName ?? ""} {best.unit ? `، واحد ${toPersianDigits(best.unit)}` : ""}، {formatToman(best.replyPrice ?? best.listedPrice)}
            {best.holdUntil ? `، نگه داشته تا ${new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit" }).format(new Date(best.holdUntil))}` : ""}
          </p>
          <div className="mt-2.5 flex gap-2">
            <a className="flex-1" href={`https://www.google.com/maps/dir/?api=1&destination=${best.lat},${best.lon}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" className="w-full">
                <Navigation className="size-4" /> مسیریابی
              </Button>
            </a>
            <Link className="flex-1" href={`/s/${best.shopId}${inq.productId ? `?p=${inq.productId}` : ""}`}>
              <Button size="sm" variant="outline" className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20">
                آدرس داخل پاساژ
              </Button>
            </Link>
          </div>
        </motion.div>
      ) : null}
      <ul className="grid gap-1.5">
        {inq.targets.map((t) => {
          const Icon = ICON[t.status];
          const good = t.status === "available" || t.status === "price_changed";
          const bad = t.status === "unavailable" || t.status === "timeout";
          return (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-sunken px-3 py-2 text-[12px]">
              <Icon className={cn("size-4 shrink-0", good ? "text-ok" : bad ? "text-bad" : "animate-pulse text-muted")} />
              <span className="min-w-0 flex-1 truncate font-medium">{t.shopName}</span>
              <span className={cn("shrink-0", good ? "text-ok" : bad ? "text-bad" : "text-muted")}>
                {LABEL[t.status]}
                {t.replyPrice ? `، ${formatToman(t.replyPrice)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {done && !best ? (
        <Link href={`/requests?focus=${inq.id}`}>
          <Button size="sm" className="w-full">جایگزین‌های باز و نزدیک را ببین</Button>
        </Link>
      ) : (
        <p className="text-[11px] text-subtle">جواب‌ها همین‌جا زنده می‌آیند؛ می‌توانی گفتگو را ادامه بدهی.</p>
      )}
    </div>
  );
}
