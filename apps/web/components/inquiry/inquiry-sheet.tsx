"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Send, Timer } from "lucide-react";
import { toast } from "sonner";
import { formatToman, toPersianDigits } from "@torob/core";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { haptic } from "@/lib/haptic";
import type { ShopOffer } from "@/lib/types";

const TIMEOUTS = [
  { s: 90, label: "۱.۵ دقیقه (دمو)" },
  { s: 300, label: "۵ دقیقه" },
  { s: 900, label: "۱۵ دقیقه" },
];

function draft(title: string, price: number | null) {
  const p = price ? ` با قیمت ثبت‌شده حدود ${formatToman(price)}` : "";
  return `سلام، وقت بخیر. «${title}»${p} الان موجوده؟ قیمت به‌روزش چنده و امروز تا چه ساعتی هستید؟ می‌خوام حضوری بیام. ممنون 🙏`;
}

/** Compose one polite question and send it to several sellers at once. */
export function InquirySheet({
  open,
  onOpenChange,
  productId,
  productTitle,
  offers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productTitle: string;
  offers: ShopOffer[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [timeout, setTimeoutSec] = useState(90);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setMessage(draft(productTitle, offers.find((o) => o.price)?.price ?? null));
  }, [open, productTitle, offers]);

  const send = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, shopIds: offers.map((o) => o.shop.id), message, timeoutSec: timeout }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "ارسال نشد");
      haptic([10, 40, 10]);
      toast.success(`استعلام برای ${toPersianDigits(offers.length)} فروشنده ارسال شد`, { description: "جواب‌ها زنده همین‌جا می‌آیند." });
      onOpenChange(false);
      router.push(`/requests?focus=${d.inquiry.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="قبل از رفتن، از فروشنده بپرس"
      description="قیمت ثبت‌شده ممکن است قدیمی باشد؛ فروشنده‌ها با یک لمس جواب می‌دهند و اگر جواب ندادند، جایگزین پیشنهاد می‌دهم."
      footer={
        <Button className="mb-1 w-full" size="lg" onClick={send} loading={busy} disabled={!offers.length || message.trim().length < 5}>
          <Send className="size-5" /> ارسال به {toPersianDigits(offers.length)} فروشنده
        </Button>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {offers.map((o) => (
          <span key={o.shop.id} className="rounded-full bg-sunken px-3 py-1 text-xs font-medium">
            {o.shop.name}
            {o.shop.mallName ? <span className="text-muted">، {o.shop.mallName}</span> : null}
          </span>
        ))}
      </div>
      <label className="mt-4 mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        <MessageCircleQuestion className="size-4 text-brand" /> متن پیام
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        className="w-full resize-none rounded-2xl border border-line bg-sunken p-3 text-sm leading-6 outline-none focus:border-brand"
      />
      <p className="mt-4 mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
        <Timer className="size-4 text-brand" /> اگر تا این مدت جواب نداد، جایگزین پیشنهاد بده
      </p>
      <div className="flex flex-wrap gap-2">
        {TIMEOUTS.map((t) => (
          <Chip key={t.s} active={timeout === t.s} onClick={() => setTimeoutSec(t.s)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <p className="mt-4 rounded-2xl bg-info-soft p-3 text-[12px] leading-5 text-fg">
        شماره‌های تلفن دیتاست نمایشی‌اند؛ پیام از طریق <b>پنل فروشنده ترب حضوری</b> به مغازه می‌رسد و جواب فروشنده برای همه کاربران به‌صورت «تأیید فروشنده» نمایش داده می‌شود.
      </p>
    </Sheet>
  );
}
