import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { MapExplorer } from "@/components/map/map-explorer";

export const metadata: Metadata = { title: "نقشه پاساژها و فروشگاه‌ها" };

export default function MapPage() {
  return (
    <AppShell wide>
      <MapExplorer />
    </AppShell>
  );
}
