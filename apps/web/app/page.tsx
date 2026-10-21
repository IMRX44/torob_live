import { AppShell } from "@/components/layout/app-shell";
import { Assistant } from "@/components/assistant/assistant";
import { topMalls } from "@/lib/server/malls";
import { sql } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [malls, categories] = await Promise.all([
    topMalls(8),
    sql()<{ name: string; shop_count: number }[]>`
      SELECT name, shop_count FROM categories
      WHERE name NOT LIKE 'سایر%' ORDER BY shop_count DESC LIMIT 14`,
  ]);
  return (
    <AppShell>
      <Assistant malls={malls} categories={[...categories]} />
    </AppShell>
  );
}
