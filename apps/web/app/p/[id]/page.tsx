import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { formatAgo, toPersianDigits } from "@torob/core";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { Gallery } from "@/components/product/gallery";
import { SpecsTable } from "@/components/product/specs";
import { WhereToBuy } from "@/components/product/where-to-buy";
import { ProductCard } from "@/components/cards/product-card";
import { PriceRange } from "@/components/badges/price";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { CompareToggle } from "@/components/product/compare-toggle";
import { BuyingChecklist } from "@/components/product/checklist";
import { AskAssistant } from "@/components/product/ask-assistant";
import { getProduct, similarProducts } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await getProduct((await params).id);
  return { title: p?.title ?? "محصول" };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  const similar = await similarProducts(id, { limit: 8 });

  return (
    <AppShell>
      <PageHeader title={product.title} subtitle={product.category} share actions={<CompareToggle product={product} />} />
      <div className="pt-3">
        <Gallery images={product.images} alt={product.title} />
        <div className="px-4 pt-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="neutral">{product.category}</Badge>
            {product.brand ? <Badge tone="info">{product.brand}</Badge> : null}
          </div>
          <h1 className="mt-2 text-xl leading-8 font-black">{product.title}</h1>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
            <PriceRange min={product.priceMin} max={product.priceMax} className="text-lg" />
            <span className="text-xs text-muted">
              {toPersianDigits(product.sellerCount)} فروشنده · آخرین تغییر قیمت {formatAgo(product.lastChange)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-subtle">بازه قیمت ثبت‌شده در ترب؛ موجودی لحظه‌ای را با استعلام بپرسید.</p>
          {product.keySpecs?.length ? (
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
              {product.keySpecs.map((s) => (
                <div key={s.key} className="shrink-0 rounded-2xl border border-line bg-elev px-3 py-2">
                  <p className="text-[10px] text-muted">{s.key}</p>
                  <p className="text-[13px] font-semibold">{s.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <AskAssistant productId={product.id} />

        <WhereToBuy productId={product.id} productTitle={product.title} />

        <Section title="قبل از خرید حضوری چک کن" hint="چک‌لیست مخصوص همین دسته">
          <BuyingChecklist category={product.category} />
        </Section>

        <Section title="مشخصات فنی">
          <SpecsTable specs={product.specs} />
        </Section>

        {similar.length ? (
          <Section title="جایگزین‌های مشابه" hint="اگر این مدل پیدا نشد یا گران بود">
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-2">
              {similar.map((p, i) => (
                <div key={p.id} className="w-40 shrink-0">
                  <ProductCard p={p} index={i} />
                </div>
              ))}
            </div>
          </Section>
        ) : null}
        <div className="h-28" />
      </div>
    </AppShell>
  );
}
