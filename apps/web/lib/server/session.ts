import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sid";
export const SELLER_COOKIE = "seller";

export function newId(prefix: string) {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

/** Anonymous shopper session (set by middleware). */
export async function getSessionId(): Promise<string> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? "anon";
}

const secret = () => process.env.SESSION_SECRET ?? "dev-secret";

export function sign(value: string) {
  return `${value}.${createHmac("sha256", secret()).update(value).digest("base64url")}`;
}

export function verify(signed: string | undefined | null): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf(".");
  if (i < 0) return null;
  const value = signed.slice(0, i);
  const expected = Buffer.from(sign(value));
  const got = Buffer.from(signed);
  return expected.length === got.length && timingSafeEqual(expected, got) ? value : null;
}

/** Shop the current seller-panel user is signed into. */
export async function getSellerShopId(): Promise<string | null> {
  const c = await cookies();
  return verify(c.get(SELLER_COOKIE)?.value);
}
