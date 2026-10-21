"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Building2, MessageCircleQuestion, Search, Scale, MapPinned, Route } from "lucide-react";
import { toPersianDigits } from "@torob/core";
import { Composer } from "./composer";
import { MallCard } from "@/components/cards/mall-card";
import { Chip } from "@/components/ui/chip";
import { Section } from "@/components/ui/section";
import type { MallSummary } from "@/lib/server/malls";

const EXAMPLES = [
  "هندزفری بلوتوثی برای باشگاه تا ۳ میلیون",
  "شارژر اصلی آیفون که الان باز باشه",
  "گوشی سامسونگ قسطی نزدیک جمهوری",
  "دوربین مداربسته برای مغازه",
  "سیم افشان ۲.۵ و کلید و پریز و لامپ",
];

const STEPS = [
  { icon: Search, title: "بگو چی لازم داری", body: "حتی اگر مدلش را نمی‌دانی" },
  { icon: Scale, title: "مقایسه و انتخاب", body: "با دلیل، نه فقط فهرست" },
  { icon: MapPinned, title: "نزدیک‌ترین فروشنده‌ها", body: "باز موقع رسیدن، چند مغازه کنار هم" },
  { icon: MessageCircleQuestion, title: "قبل از رفتن بپرس", body: "تأیید قیمت و موجودی، و جایگزین فوری" },
];

export function Hero({ onSend, malls, categories }: { onSend: (t: string) => void; malls: MallSummary[]; categories: { name: string; shop_count: number }[] }) {
  return (
    <div className="pb-40">
      <div className="relative overflow-hidden px-4 pt-8 pb-2">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[130%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklch,var(--brand)_22%,transparent),transparent)]" />
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative text-[28px] leading-[1.35] font-black tracking-tight">
          امروز چی لازم داری؟
          <span className="block text-[17px] font-semibold text-muted">می‌گردم، مقایسه می‌کنم، از فروشنده می‌پرسم و تا دم مغازه همراهتم.</span>
        </motion.h1>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="relative mt-5">
          <Composer onSend={onSend} size="lg" autoFocus={false} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }} className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {EXAMPLES.map((e) => (
            <Chip key={e} onClick={() => onSend(e)}>
              {e}
            </Chip>
          ))}
        </motion.div>
      </div>

      <div className="mx-4 mt-6 grid grid-cols-2 gap-2.5">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 + i * 0.05 }}
            className="rounded-[20px] border border-line bg-elev p-3"
          >
            <span className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon className="size-4" />
              </span>
              <span className="text-[11px] font-bold text-subtle">گام {toPersianDigits(i + 1)}</span>
            </span>
            <p className="mt-2 text-[13px] font-bold">{title}</p>
            <p className="text-[11px] leading-5 text-muted">{body}</p>
          </motion.div>
        ))}
      </div>

      <Link href="/trip" className="mx-4 mt-3 flex items-center gap-3 rounded-[20px] bg-gradient-to-l from-info-soft to-brand-soft p-3.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-elev text-brand shadow-sm">
          <Route className="size-5" />
        </span>
        <span className="flex-1">
          <b className="block text-[14px]">لیست خرید چندقلمی داری؟</b>
          <span className="text-[12px] text-muted">کمترین توقف و کوتاه‌ترین مسیر را برایت می‌چینم.</span>
        </span>
      </Link>

      <Section title="پاساژهای پرفروشنده" hint="جایی که چند فروشنده کنار هم‌اند، شانس دست‌خالی برنگشتن بیشتر است" action={<Building2 className="size-5 text-subtle" />}>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {malls.map((m) => (
            <MallCard key={m.id} mall={m} />
          ))}
        </div>
      </Section>

      <Section title="دسته‌های پرطرفدار در مغازه‌ها">
        <div className="flex flex-wrap gap-2 px-4">
          {categories.map((c) => (
            <Chip key={c.name} onClick={() => onSend(c.name)}>
              {c.name}
              <span className="text-[11px] text-subtle">{toPersianDigits(c.shop_count)} مغازه</span>
            </Chip>
          ))}
        </div>
      </Section>
    </div>
  );
}
