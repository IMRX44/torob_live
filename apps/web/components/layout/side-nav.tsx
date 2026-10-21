"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Route, MessagesSquare, Database, Store } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

const items = [
  { href: "/", label: "دستیار خرید", icon: Home },
  { href: "/map", label: "نقشه فروشگاه‌ها", icon: Map },
  { href: "/trip", label: "سفر خرید چندقلمی", icon: Route },
  { href: "/requests", label: "استعلام‌های من", icon: MessagesSquare },
  { href: "/data", label: "شفافیت داده", icon: Database },
  { href: "/seller", label: "پنل فروشنده", icon: Store },
];

/** Desktop navigation rail (hidden on mobile where the bottom nav is used). */
export function SideNav() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-e border-line bg-elev px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 px-2">
        <Logo />
      </Link>
      <ul className="space-y-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition-colors",
                  active ? "bg-brand-soft text-brand" : "text-muted hover:bg-sunken hover:text-fg",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto px-2 text-[11px] leading-5 text-subtle">
        داده‌ها از دیتاست ترب، قیمت ثبت‌شده با موجودی تأییدشده یکی نیست.
      </p>
    </aside>
  );
}
