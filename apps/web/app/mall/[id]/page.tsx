import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { MallView } from "@/components/mall/mall-view";
import { getMall } from "@/lib/server/malls";
import { getProduct } from "@/lib/server/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const m = await getMall((await params).id);
  return { title: m?.name ?? "پاساژ" };
}

export default async function MallPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string }> }) {
  const { id } = await params;
  const { p } = await searchParams;
  const [mall, product] = await Promise.all([getMall(id, { productId: p ?? null }), p ? getProduct(p) : Promise.resolve(null)]);
  if (!mall) notFound();
  return (
    <AppShell>
      <PageHeader title={mall.name} subtitle={mall.area ?? ""} share />
      <MallView mall={mall} product={product ? { id: product.id, title: product.title, image: product.image } : null} />
    </AppShell>
  );
}
