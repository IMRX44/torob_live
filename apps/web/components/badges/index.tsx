"use client";
import {
  BadgeCheck,
  Clock,
  CreditCard,
  HelpCircle,
  History,
  ShieldCheck,
  Store,
  TriangleAlert,
  Users,
  Zap,
  CircleSlash,
} from "lucide-react";
import { channelLabel, formatAgo, REASON_LABEL, type Freshness, type PaymentOption, type ReasonCode } from "@torob/core";
import { Badge, type Tone } from "@/components/ui/badge";
import type { Confirmation, OpenInfo, ShopOffer, Warranty } from "@/lib/types";
import { toPersianDigits } from "@torob/core";

const FRESH: Record<Freshness, { tone: Tone; label: string }> = {
  confirmed: { tone: "ok", label: "تأیید فروشنده" },
  fresh: { tone: "ok", label: "قیمت تازه" },
  recent: { tone: "info", label: "قیمت ثبت‌شده" },
  aging: { tone: "warn", label: "قیمت قدیمی‌تر" },
  stale: { tone: "neutral", label: "قیمت قدیمی" },
  unknown: { tone: "neutral", label: "زمان قیمت نامعلوم" },
};

/** Registered price age, never presented as a confirmation. */
export function FreshnessBadge({ freshness, changedAt, confirmation }: { freshness: Freshness; changedAt: string | null; confirmation?: Confirmation | null }) {
  if (confirmation?.available) {
    return (
      <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />} title="فروشنده قیمت و موجودی را از طریق ترب حضوری تأیید کرده">
        {confirmation.source === "seller" ? "تأیید فروشنده" : "گزارش کاربر"}، {formatAgo(confirmation.at)}
      </Badge>
    );
  }
  const f = FRESH[freshness];
  return (
    <Badge tone={f.tone} icon={<History className="size-3.5" />} title="زمان آخرین تغییر قیمت در ترب؛ به معنی تأیید موجودی نیست">
      {f.label}
      {changedAt ? `، ${formatAgo(changedAt)}` : ""}
    </Badge>
  );
}

export function StockBadge({ offer }: { offer: Pick<ShopOffer, "listed" | "confirmation"> }) {
  if (offer.confirmation) {
    return offer.confirmation.available ? (
      <Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>موجود (تأییدشده)</Badge>
    ) : (
      <Badge tone="bad" icon={<CircleSlash className="size-3.5" />}>ندارد، {formatAgo(offer.confirmation.at)}</Badge>
    );
  }
  if (!offer.listed) {
    return (
      <Badge tone="neutral" icon={<HelpCircle className="size-3.5" />} title="این فروشگاه فقط در این صنف ثبت شده؛ دسته فعالیت به معنی موجود بودن محصول نیست">
        فقط صنف مرتبط، نامشخص
      </Badge>
    );
  }
  return (
    <Badge tone="neutral" icon={<Store className="size-3.5" />} title="فروشنده این محصول را ثبت کرده ولی موجودی لحظه‌ای تأیید نشده">
      ثبت‌شده، موجودی تأیید نشده
    </Badge>
  );
}

export function HoursBadge({ open }: { open: OpenInfo }) {
  const tone: Tone = open.state === "open" ? (open.closingSoon ? "warn" : "ok") : open.state === "closed" ? "bad" : "neutral";
  return (
    <Badge tone={tone} icon={<Clock className="size-3.5" />}>
      {open.label}
    </Badge>
  );
}

const PROVIDER_SHORT: Record<PaymentOption["providerKey"], string> = {
  torobpay: "ترب‌پی",
  snapppay: "اسنپ‌پی",
  digipay: "دیجی‌پی",
  tara: "تارا",
  other: "اعتباری",
};

export function PaymentBadges({ payments, compact }: { payments: PaymentOption[]; compact?: boolean }) {
  if (!payments.length) return compact ? null : <Badge tone="neutral" icon={<CreditCard className="size-3.5" />}>خرید قسطی اعلام نشده</Badge>;
  if (compact) {
    return (
      <Badge tone="info" icon={<CreditCard className="size-3.5" />} title={payments.map((p) => `${p.provider}، ${channelLabel(p.channel)}`).join("\n")}>
        قسطی: {[...new Set(payments.map((p) => PROVIDER_SHORT[p.providerKey]))].join("، ")}
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {payments.map((p) => (
        <Badge key={p.provider + p.channel} tone={p.channel === "in_person" ? "info" : "neutral"} icon={<CreditCard className="size-3.5" />}>
          {p.provider}، {channelLabel(p.channel)}
        </Badge>
      ))}
    </div>
  );
}

export function WarrantyBadge({ warranty }: { warranty: Warranty | null }) {
  if (!warranty) return null;
  const parts = [warranty.provider, warranty.months ? `${toPersianDigits(warranty.months)} ماهه` : null, warranty.description].filter(Boolean);
  return (
    <Badge tone="info" icon={<ShieldCheck className="size-3.5" />} className="max-w-full truncate">
      {parts.join("، ") || "گارانتی"}
    </Badge>
  );
}

export function FastBadge({ value }: { value: boolean | null }) {
  if (value !== true) return null;
  return <Badge tone="brand" icon={<Zap className="size-3.5" />}>ارسال فوری</Badge>;
}

const REASON_TONE: Partial<Record<ReasonCode, Tone>> = {
  cheapest: "ok",
  cheap: "ok",
  nearest: "info",
  near: "info",
  confirmed: "ok",
  open_long: "ok",
  hub: "brand",
  closing_soon: "warn",
  closed: "bad",
  stale_price: "warn",
  category_only: "neutral",
  fresh_price: "ok",
  installment: "info",
  warranty: "info",
};

export function ReasonChips({ reasons, max = 4 }: { reasons: ReasonCode[]; max?: number }) {
  if (!reasons.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {reasons.slice(0, max).map((r) => (
        <Badge key={r} tone={REASON_TONE[r] ?? "neutral"} icon={r === "hub" ? <Users className="size-3" /> : r === "closed" || r === "stale_price" ? <TriangleAlert className="size-3" /> : undefined}>
          {REASON_LABEL[r]}
        </Badge>
      ))}
    </div>
  );
}
