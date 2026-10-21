import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSellerShopId } from "@/lib/server/session";
import { getShop } from "@/lib/server/catalog";
import { SellerInbox } from "@/components/seller/inbox";

export const metadata: Metadata = { title: "صندوق استعلام‌ها" };
export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const shopId = await getSellerShopId();
  if (!shopId) redirect("/seller");
  const shop = await getShop(shopId);
  if (!shop) redirect("/seller");
  return <SellerInbox shop={{ id: shop.id, name: shop.name, mallName: shop.mallName, floor: shop.floor, unit: shop.unit }} />;
}
