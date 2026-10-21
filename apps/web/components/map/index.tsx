"use client";
import dynamic from "next/dynamic";

/** Map is client-only (WebGL); this wrapper keeps SSR happy and shows a skeleton meanwhile. */
export const LazyMap = dynamic(() => import("./shop-map").then((m) => m.ShopMap), {
  ssr: false,
  loading: () => <div className="skeleton h-full w-full" />,
});
export type { MapPin, MapCircle } from "./shop-map";
