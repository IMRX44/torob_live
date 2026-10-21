import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import { cn } from "@/lib/cn";

/** Mobile-first frame: bottom nav on phones, side rail + wider canvas on desktop. */
export function AppShell({ children, wide, noNav }: { children: ReactNode; wide?: boolean; noNav?: boolean }) {
  return (
    <div className="flex min-h-dvh">
      {noNav ? null : <SideNav />}
      <main className={cn("mx-auto w-full min-w-0 flex-1 overflow-x-clip pb-24 lg:pb-10", wide ? "max-w-6xl" : "max-w-2xl")}>{children}</main>
      {noNav ? null : <BottomNav />}
    </div>
  );
}
