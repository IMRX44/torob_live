"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Map, Route, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { useInquiryBadge } from "@/lib/hooks/use-inquiries";

const items = [
  { href: "/", label: "دستیار", icon: Home },
  { href: "/map", label: "نقشه", icon: Map },
  { href: "/trip", label: "سفر خرید", icon: Route },
  { href: "/requests", label: "استعلام‌ها", icon: MessagesSquare },
];

export function BottomNav() {
  const path = usePathname();
  const badge = useInquiryBadge();
  return (
    <nav
      aria-label="ناوبری اصلی"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-elev/90 backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted hover:text-fg",
                )}
              >
                <Icon className={cn("size-[22px] transition-transform", active && "scale-110")} strokeWidth={active ? 2.4 : 1.9} />
                {label}
                {href === "/requests" && badge > 0 ? (
                  <span className="absolute top-1.5 left-1/2 ms-3 grid min-w-4.5 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4.5 font-bold text-brand-fg animate-pop">
                    {badge.toLocaleString("fa-IR")}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
