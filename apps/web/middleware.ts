import { NextResponse, type NextRequest } from "next/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Gives every visitor an anonymous session id (used for inquiries, trips and reports). */
export function middleware(req: NextRequest) {
  if (req.cookies.get("sid")) return NextResponse.next();

  const id = `s_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  // Make the new id visible to this very request's server code, not just the next one.
  req.cookies.set("sid", id);
  const headers = new Headers(req.headers);
  headers.set("cookie", req.cookies.toString());
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set("sid", id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: ONE_YEAR });
  return res;
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|manifest|sw.js|.*\\.(?:svg|png|jpg|webp|woff2?)$).*)"],
};
