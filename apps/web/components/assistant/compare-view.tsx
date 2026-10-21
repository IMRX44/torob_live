"use client";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CompareCard } from "./tool-cards";
import { useApp } from "@/lib/store";
import { useJson } from "@/lib/hooks/use-fetch";
import { useContextQuery } from "@/lib/hooks/use-context-query";
import type { ProductSummary } from "@/lib/types";

export function CompareView() {
  const { compare, clearCompare } = useApp();
  const qs = useContextQuery({ ids: compare.map((c) => c.id).join(",") });
  const { data, loading } = useJson<{ products: ProductSummary[]; rows: { key: string; values: (string | null)[]; differs: boolean }[] }>(compare.length >= 2 ? `/api/compare?${qs}` : null);
  return (
    <>
      <PageHeader title="مقایسه محصولات" actions={compare.length ? <Button variant="ghost" size="sm" onClick={clearCompare}>پاک کردن</Button> : null} />
      <div className="px-4 pt-2 pb-10">
        {compare.length < 2 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line-strong p-8 text-center">
            <GitCompareArrows className="mx-auto size-10 text-subtle" />
            <p className="mt-2 font-bold">حداقل دو محصول برای مقایسه انتخاب کنید</p>
            <p className="mt-1 text-sm text-muted">روی کارت محصولات علامت + را بزنید.</p>
            <Link href="/">
              <Button className="mt-4">رفتن به دستیار</Button>
            </Link>
          </div>
        ) : loading && !data ? (
          <div className="skeleton mt-3 h-96 rounded-[24px]" />
        ) : data ? (
          <>
            <CompareCard data={data} />
            <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${data.products.length}, minmax(0,1fr))` }}>
              {data.products.map((p) => (
                <Link key={p.id} href={`/p/${p.id}`}>
                  <Button variant="secondary" size="sm" className="w-full">
                    فروشنده‌ها
                  </Button>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
