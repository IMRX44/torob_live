/** Inquiry DTOs shared by server and client. */

export type TargetStatus = "pending" | "seen" | "available" | "price_changed" | "unavailable" | "alternative" | "timeout";

export interface InquiryTarget {
  id: string;
  shopId: string;
  shopName: string;
  mallName: string | null;
  floor: number | null;
  unit: string | null;
  lat: number;
  lon: number;
  listedPrice: number | null;
  status: TargetStatus;
  replyPrice: number | null;
  replyNote: string | null;
  altProductId: string | null;
  altProductTitle: string | null;
  holdUntil: string | null;
  openUntil: string | null;
  seenAt: string | null;
  repliedAt: string | null;
}

export interface Inquiry {
  id: string;
  productId: string | null;
  productTitle: string | null;
  productImage: string | null;
  message: string;
  createdAt: string;
  deadline: string;
  targets: InquiryTarget[];
}

export interface SellerInboxItem {
  targetId: string;
  inquiryId: string;
  productId: string | null;
  productTitle: string | null;
  productImage: string | null;
  message: string;
  listedPrice: number | null;
  status: TargetStatus;
  createdAt: string;
  deadline: string;
}

