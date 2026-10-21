import type { Metadata } from "next";
import { BadgeCheck, Clock, CreditCard, Database, HelpCircle, History, Store } from "lucide-react";
import { formatAgo, toPersianDigits } from "@torob/core";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { sql } from "@/lib/server/db";

export const metadata: Metadata = { title: "شفافیت داده" };
export const dynamic = "force-dynamic";

type Report = {
  generatedAt: string;
  shops: { total: number; withOffers: number; categoryOnly: number; realNames: number; hoursKnown: number; withPayments: number; torobPayInPerson: number; fastDelivery: { yes: number; no: number; unknown: number }; inMall: number; withFloor: number; withUnit: number; topAreas: [string, number][] };
  malls: { total: number };
  products: { total: number; withSpecs: number; withBrand: number; multiSeller: number; categories: number };
  offers: { total: number; priceQuality: { valid: number; missing: number; outlier: number }; withWarranty: number; oldestChange: string; newestChange: string };
};

const pct = (a: number, b: number) => `${toPersianDigits(Math.round((a / Math.max(1, b)) * 100))}٪`;

function Bar({ label, value, total, tone = "bg-brand" }: { label: string; value: number; total: number; tone?: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12px]">
        <span>{label}</span>
        <span className="text-muted tabular">
          {toPersianDigits(value.toLocaleString("en-US"))} · {pct(value, total)}
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-sunken">
        <div className={`h-2 rounded-full ${tone}`} style={{ width: `${Math.max(2, (value / Math.max(1, total)) * 100)}%` }} />
      </div>
    </div>
  );
}

export default async function DataPage() {
  const [row] = await sql()<{ report: Report }[]>`SELECT report FROM dataset_report WHERE id = 1`;
  const [live] = await sql()<{ inquiries: number; confirmations: number; reports: number }[]>`
    SELECT (SELECT count(*) FROM inquiries)::int AS inquiries, (SELECT count(*) FROM confirmations WHERE source='seller')::int AS confirmations,
           (SELECT count(*) FROM crowd_reports)::int AS reports`;
  const r = row?.report;
  return (
    <AppShell>
      <PageHeader title="شفافیت داده" subtitle="هر برچسب در برنامه دقیقاً از کجا می‌آید" />
      {!r ? (
        <p className="p-4 text-sm text-muted">دیتاست هنوز بارگذاری نشده است.</p>
      ) : (
        <div className="space-y-4 px-4 pt-4 pb-10">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["فروشگاه", r.shops.total],
              ["محصول", r.products.total],
              ["آفر قیمت", r.offers.total],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-2xl border border-line bg-elev p-3">
                <p className="text-lg font-black tabular">{toPersianDigits((v as number).toLocaleString("en-US"))}</p>
                <p className="text-[11px] text-muted">{k}</p>
              </div>
            ))}
          </div>

          <section className="rounded-[22px] border border-line bg-elev p-4">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><Store className="size-4 text-brand" /> فروشگاه‌ها</h2>
            <div className="mt-3 space-y-3">
              <Bar label="کالای مشخص ثبت کرده‌اند" value={r.shops.withOffers} total={r.shops.total} tone="bg-ok" />
              <Bar label="فقط دسته فعالیت (نشانه موجود بودن نیست)" value={r.shops.categoryOnly} total={r.shops.total} tone="bg-line-strong" />
              <Bar label="ساعت کاری ثبت‌شده" value={r.shops.hoursKnown} total={r.shops.total} />
              <Bar label="داخل پاساژ / مجتمع" value={r.shops.inMall} total={r.shops.total} />
              <Bar label="طبقه در آدرس" value={r.shops.withFloor} total={r.shops.total} />
              <Bar label="واحد یا پلاک در آدرس" value={r.shops.withUnit} total={r.shops.total} />
              <Bar label="خرید قسطی اعلام کرده" value={r.shops.withPayments} total={r.shops.total} tone="bg-info" />
              <Bar label="پذیرنده حضوری ترب‌پی (صریح)" value={r.shops.torobPayInPerson} total={r.shops.total} tone="bg-info" />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-subtle">
              نام {toPersianDigits(r.shops.total - r.shops.realNames)} فروشگاه و همه شماره‌ها در دیتاست نمایشی‌اند؛ مکان‌ها واقعی‌اند. پراکندگی:{" "}
              {r.shops.topAreas.slice(0, 4).map(([a, n]) => `${a} (${toPersianDigits(n)})`).join("، ")}.
            </p>
          </section>

          <section className="rounded-[22px] border border-line bg-elev p-4">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><History className="size-4 text-brand" /> قیمت‌ها</h2>
            <div className="mt-3 space-y-3">
              <Bar label="قیمت معتبر" value={r.offers.priceQuality.valid} total={r.offers.total} tone="bg-ok" />
              <Bar label="بدون قیمت" value={r.offers.priceQuality.missing} total={r.offers.total} tone="bg-line-strong" />
              <Bar label="قیمت نامعتبر (زیر ۱۰۰۰ یا بالای ۵۰ میلیارد تومان)" value={r.offers.priceQuality.outlier} total={r.offers.total} tone="bg-bad" />
              <Bar label="گارانتی ثبت‌شده" value={r.offers.withWarranty} total={r.offers.total} tone="bg-info" />
            </div>
            <p className="mt-3 text-[11px] leading-5 text-subtle">
              آخرین تغییر قیمت‌ها از {formatAgo(r.offers.oldestChange)} تا {formatAgo(r.offers.newestChange)} است. «زمان تغییر قیمت» یعنی آخرین باری که فروشنده قیمت را عوض کرده، نه تأیید موجودی.
            </p>
          </section>

          <section className="rounded-[22px] border border-line bg-elev p-4">
            <h2 className="flex items-center gap-1.5 text-[14px] font-bold"><Database className="size-4 text-brand" /> محصولات</h2>
            <div className="mt-3 space-y-3">
              <Bar label="مشخصات فنی دارند" value={r.products.withSpecs} total={r.products.total} />
              <Bar label="برند مشخص" value={r.products.withBrand} total={r.products.total} />
              <Bar label="دو فروشنده یا بیشتر (قابل مقایسه)" value={r.products.multiSeller} total={r.products.total} tone="bg-ok" />
            </div>
            <p className="mt-3 text-[11px] text-subtle">{toPersianDigits(r.products.categories)} دسته · {toPersianDigits(r.malls.total)} پاساژ و مجتمع شناسایی‌شده از روی آدرس‌ها</p>
          </section>

          <section className="rounded-[22px] border border-line bg-elev p-4">
            <h2 className="text-[14px] font-bold">برچسب‌ها چه معنایی دارند؟</h2>
            <ul className="mt-3 space-y-3 text-[12px] leading-5">
              <li className="flex gap-2"><Badge tone="ok" icon={<BadgeCheck className="size-3.5" />}>تأیید فروشنده</Badge> فروشنده در ۲۴ ساعت اخیر از پنل فروشنده موجودی/قیمت را تأیید کرده.</li>
              <li className="flex gap-2"><Badge tone="neutral" icon={<Store className="size-3.5" />}>ثبت‌شده</Badge> کالا در ترب ثبت شده ولی موجودی لحظه‌ای تأیید نشده.</li>
              <li className="flex gap-2"><Badge tone="neutral" icon={<HelpCircle className="size-3.5" />}>فقط صنف</Badge> مغازه در این صنف است؛ ممکن است این کالا را نداشته باشد.</li>
              <li className="flex gap-2"><Badge tone="warn" icon={<History className="size-3.5" />}>قیمت قدیمی‌تر</Badge> بیش از ۲ هفته از آخرین تغییر قیمت گذشته.</li>
              <li className="flex gap-2"><Badge tone="ok" icon={<Clock className="size-3.5" />}>باز تا …</Badge> بر اساس ساعت کاری اعلام‌شده و زمان رسیدن شما.</li>
              <li className="flex gap-2"><Badge tone="info" icon={<CreditCard className="size-3.5" />}>قسطی</Badge> سرویس اعتباری اعلام‌شده توسط فروشنده، همراه با نوع پذیرش.</li>
            </ul>
          </section>

          <section className="rounded-[22px] border border-line bg-elev p-4 text-[12px]">
            <h2 className="mb-2 text-[14px] font-bold">داده زنده ترب حضوری</h2>
            {toPersianDigits(live?.inquiries ?? 0)} استعلام · {toPersianDigits(live?.confirmations ?? 0)} تأیید فروشنده · {toPersianDigits(live?.reports ?? 0)} گزارش حضوری کاربران
          </section>
        </div>
      )}
    </AppShell>
  );
}
