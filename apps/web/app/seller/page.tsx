import type { Metadata } from "next";
import { SellerLogin } from "@/components/seller/login";

export const metadata: Metadata = { title: "پنل فروشنده" };

export default function SellerPage() {
  return <SellerLogin />;
}
