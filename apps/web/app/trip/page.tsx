import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { TripPlanner } from "@/components/trip/trip-planner";

export const metadata: Metadata = { title: "سفر خرید چندقلمی" };

export default async function TripPage({ searchParams }: { searchParams: Promise<{ items?: string }> }) {
  const { items } = await searchParams;
  return (
    <AppShell>
      <TripPlanner initial={items ? items.split("|").filter(Boolean).slice(0, 8) : []} />
    </AppShell>
  );
}
