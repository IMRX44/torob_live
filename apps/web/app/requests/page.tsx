import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { RequestsView } from "@/components/requests/requests-view";

export const metadata: Metadata = { title: "استعلام‌های من" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  return (
    <AppShell>
      <RequestsView focus={focus ?? null} />
    </AppShell>
  );
}
