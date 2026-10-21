import { getSellerShopId } from "@/lib/server/session";
import { sellerInbox } from "@/lib/server/inquiries";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  return json({ items: await sellerInbox(shopId) });
}
