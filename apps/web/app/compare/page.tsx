import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { CompareView } from "@/components/assistant/compare-view";

export const metadata: Metadata = { title: "مقایسه محصولات" };

export default function ComparePage() {
  return (
    <AppShell>
      <CompareView />
    </AppShell>
  );
}
