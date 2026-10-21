/** Seller-declared purchase options (installments / in-person Torob Pay). */

export interface RawPaymentOption {
  provider_name?: string | null;
  channel?: string | null;
  category_names?: string[] | null;
  min_price_toman?: number | null;
  max_price_toman?: number | null;
}

export type PaymentChannel = "in_person" | "online" | "unknown";

export interface PaymentOption {
  provider: string;
  providerKey: "torobpay" | "snapppay" | "digipay" | "tara" | "other";
  channel: PaymentChannel;
  /** Every provider in the export is a credit / buy-now-pay-later service. */
  installment: boolean;
  categories: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

function providerKey(name: string): PaymentOption["providerKey"] {
  const n = name.replace(/‌/g, "").replace(/\s/g, "");
  if (n.includes("ترب")) return "torobpay";
  if (n.includes("اسنپ")) return "snapppay";
  if (n.includes("دیجی")) return "digipay";
  if (n.includes("تارا")) return "tara";
  return "other";
}

export function parsePayments(raw: unknown): PaymentOption[] {
  const arr = (typeof raw === "string" ? safeParse(raw) : raw) as RawPaymentOption[] | null;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((p) => p && p.provider_name)
    .map((p) => {
      const ch = p.channel === "in_person" ? "in_person" : p.channel === "online" ? "online" : "unknown";
      return {
        provider: p.provider_name!,
        providerKey: providerKey(p.provider_name!),
        channel: ch,
        installment: true,
        categories: p.category_names ?? [],
        minPrice: p.min_price_toman ?? null,
        maxPrice: p.max_price_toman ?? null,
      } satisfies PaymentOption;
    });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function channelLabel(c: PaymentChannel): string {
  return c === "in_person" ? "پذیرش حضوری" : c === "online" ? "فقط آنلاین" : "نوع پذیرش اعلام نشده";
}

/** Does an option apply to a given purchase (category and price bounds)? */
export function paymentApplies(p: PaymentOption, category: string | null, price: number | null): boolean {
  if (p.categories.length && category && !p.categories.includes(category)) return false;
  if (price != null && p.minPrice != null && price < p.minPrice) return false;
  if (price != null && p.maxPrice != null && price > p.maxPrice) return false;
  return true;
}
