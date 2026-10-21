"use client";
import { LazyMap } from "@/components/map";
import { useApp } from "@/lib/store";

export function ShopMiniMap({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const origin = useApp((s) => s.origin);
  return <LazyMap origin={origin} pins={[{ id: "shop", lat, lon, label, tone: "brand" }]} fitToPins={false} focus={{ lat, lon, zoom: 16 }} />;
}
