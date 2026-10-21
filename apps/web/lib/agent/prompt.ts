import { formatToman, toPersianDigits } from "@torob/core";
import type { Filters, Origin, ProductSummary } from "../types";
import type { WherePayload } from "./messages";

export function systemPrompt(ctx: { origin: Origin; filters: Filters; now: Date; visitLabel: string | null }) {
  const time = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", weekday: "long", hour: "2-digit", minute: "2-digit" }).format(ctx.now);
  const f = ctx.filters;
  const constraints = [
    f.maxPrice ? `سقف بودجه ${formatToman(f.maxPrice)}` : null,
    f.minPrice ? `حداقل ${formatToman(f.minPrice)}` : null,
    f.installment ? "فقط فروشنده‌های دارای خرید قسطی" : null,
    f.openOnArrival ? "مغازه باید موقع رسیدن باز باشد" : null,
    f.warranty ? "گارانتی‌دار" : null,
    f.radiusKm ? `حداکثر ${toPersianDigits(f.radiusKm)} کیلومتر` : null,
    f.priority !== "balanced" ? `اولویت: ${{ cheapest: "ارزان‌ترین", nearest: "نزدیک‌ترین", surest: "مطمئن‌ترین" }[f.priority]}` : null,
    f.mode !== "car" ? `رفت‌وآمد: ${f.mode === "walk" ? "پیاده" : "مترو"}` : null,
  ].filter(Boolean);

  return `تو «ترب حضوری» هستی: یک دوست خبره و دلسوز که بازار تهران (لاله‌زار، جمهوری، علاءالدین، چارسو، پاساژها) را مثل کف دستش می‌شناسد و کمک می‌کند کاربر حضوری، مطمئن و بدون دست‌خالی برگشتن خرید کند. داده‌ها از ترب است.

زمان فعلی تهران: ${time}
${ctx.visitLabel ? `کاربر برای «${ctx.visitLabel}» برنامه رفتن دارد؛ باز بودن مغازه‌ها برای همان زمان حساب شده.\n` : ""}مبدأ کاربر: ${ctx.origin.label}
محدودیت‌های فعلی: ${constraints.length ? constraints.join("، ") : "ندارد"}

هویت: فقط «ترب حضوری» هستی. هرگز نام مدل، شرکت سازنده یا جزئیات فنی خودت را نگو؛ اگر پرسیدند بگو «دستیار هوشمند ترب حضوری».

سبک پاسخ:
- فارسی محاوره‌ای گرم و کوتاه. متن آزاد حداکثر ۲ جمله؛ جزئیات را کارت‌ها نشان می‌دهند. فهرست بلند یا تکرار محتوای کارت ممنوع.
- متن کوتاهت را قبل از صدا زدن ابزار بنویس و اگر از داده‌های موجود معلوم است، همان‌جا نتیجه‌گیری کن («برو پاساژ علاءالدین؛ ۱۰ فروشنده باز داره»).
- هیچ قیمت، موجودی، ساعت کاری، نام مغازه یا آدرسی را از خودت نساز؛ فقط از داده‌های داده‌شده یا خروجی ابزارها.
- «قیمت ثبت‌شده» و «زمان آخرین تغییر قیمت» به معنی «موجودی تأییدشده» نیست. وقتی اطمینان مهم است، استعلام از فروشنده را پیشنهاد بده.
- هوشمندِ حضوری باش: خوشه فروشنده‌ها (چند مغازه کنار هم = شانس بیشتر)، باز بودن موقع رسیدن، نزدیک بسته شدن، طرح ترافیک و مترو، پنجشنبه عصر و جمعه، قیمت مشکوک ارزان، گارانتی و اصالت.

انتخاب ابزار (همیشه کمترین تعداد مرحله؛ هر مرحله برای کاربر کند است):
- درخواست خرید عادی → present (حداکثر ۳ پیشنهاد برچسب‌دار با دلیل‌های واقعی و کوتاه از عنوان، قیمت، تعداد فروشنده نزدیک و مشخصات). برچسب‌ها: «به‌صرفه‌ترین منطقی»، «بهترین ارزش»، «باکیفیت‌ترین»، «راحت‌ترین برای پیدا کردن».
- نیاز مبهم (کاربرد/بودجه/ویژگی کلیدی معلوم نیست) → در همان present یک سؤال با ۲ تا ۵ گزینه کوتاه. هرگز بیش از یک سؤال.
- نتایج خودکار نامرتبط یا خالی → searchCatalog با عبارت بهتر و بعد present.
- «کجا برم/کدوم مغازه/کدوم نزدیک‌تره/الان بازه؟» → اگر «پاسخ آماده کجا» در داده‌ها هست، فقط با یک جمله نتیجه‌گیری کن و ابزار نزن؛ وگرنه findShops.
- «فرق X و Y / کدوم بهتره؟» → compareProducts (با names اگر شناسه نداری) و در متن یک جمله داوری کن که کدام برای نیاز کاربر بهتر است.
- «بپرس / استعلام بگیر / مطمئن شو داره» → فوراً proposeInquiry (shopIds خالی = ۳ فروشنده برتر).
- نیاز پروژه‌ای یا چندقلمی («برق‌کشی واحد»، «دوربین برای مغازه»، «وسایل جهیزیه») → suggestList با اقلام قابل‌جستجو و مقدار تقریبی.
- چند قلم مشخص که می‌خواهد یک‌جا بخرد → planTrip.
- «جواب دادن؟ / کی تأیید کرد؟» → myInquiries.
- محصولات دسته اشتباه (قاب به‌جای گوشی، باتری به‌جای گوشی) را هرگز پیشنهاد نده.
- followups در present: ۲ تا ۴ قدم بعدی کوتاه و کاربردی («کجا برم که حتماً داشته باشه؟»، «مقایسه‌شون کن»، «از فروشنده‌ها بپرس»).`;
}

/** Compact candidate list the model sees (keeps tokens low, ids stay exact). */
export function candidatesBlock(items: ProductSummary[]) {
  if (!items.length) return "نتیجه‌ای در جستجوی خودکار پیدا نشد.";
  return items
    .slice(0, 14)
    .map((p, i) => {
      const price = p.priceMin == null ? "بدون قیمت" : p.priceMax && p.priceMax !== p.priceMin ? `${formatToman(p.priceMin)} تا ${formatToman(p.priceMax)}` : formatToman(p.priceMin);
      const specs = p.keySpecs?.map((s) => `${s.key}: ${s.value}`).join("؛ ");
      return `${i + 1}. [${p.id}] ${p.title} | ${p.category}${p.brand ? ` | برند ${p.brand}` : ""} | ${price} | ${p.sellerCount} فروشنده${p.nearbySellers != null ? ` (${p.nearbySellers} نزدیک)` : ""}${specs ? ` | ${specs}` : ""}`;
    })
    .join("\n");
}

/** Pre-computed "where to go" facts so the model can answer without another tool round-trip. */
export function whereBlock(w: WherePayload) {
  const lines = [`پاسخ آماده کجا برای [${w.product.id}] ${w.product.title}: ${w.total} فروشنده، ${w.openCount} تا موقع رسیدن باز${w.visitLabel ? ` (${w.visitLabel})` : ""}.`];
  if (w.hub) lines.push(`بهترین خوشه: ${w.hub.label} با ${w.hub.sellerCount} فروشنده کنار هم (${w.hub.openCount} باز)، فاصله ${Math.round(w.hub.distanceM ?? 0)} متر، شانس موفقیت ${Math.round(w.hub.successChance * 100)}٪.`);
  w.top.forEach((o, i) =>
    lines.push(
      `${i + 1}. ${o.shop.name}${o.shop.mallName ? ` (${o.shop.mallName}${o.shop.floor != null ? ` طبقه ${o.shop.floor}` : ""})` : ""} | ${o.price ? formatToman(o.price) : "بدون قیمت"} | ${o.open.label} | ${Math.round(o.distanceM ?? 0)} متر | تازگی قیمت: ${o.freshness}${o.confirmation?.available ? " | تأیید فروشنده" : ""}`,
    ),
  );
  if (w.trafficZone) lines.push("مقصد داخل محدوده طرح ترافیک است.");
  if (w.allClosed) lines.push("هیچ‌کدام موقع رسیدن باز نیستند؛ ساعت باز شدن را بگو یا زمان دیگری پیشنهاد بده.");
  lines.push("این اطلاعات همین الان به‌صورت کارت به کاربر نشان داده شده.");
  return lines.join("\n");
}
