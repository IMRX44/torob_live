import { SELLER_COOKIE } from "@/lib/server/session";
import { json } from "@/lib/server/http";

export async function POST() {
  const res = json({ ok: true });
  res.cookies.delete(SELLER_COOKIE);
  return res;
}
