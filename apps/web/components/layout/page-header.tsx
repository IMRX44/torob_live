"use client";
import { useRouter } from "next/navigation";
import { ArrowRight, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

export function PageHeader({ title, subtitle, actions, className, share }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string; share?: boolean }) {
  const router = useRouter();
  return (
    <header className={cn("sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line/60 bg-bg/85 px-2 backdrop-blur-xl", className)}>
      <button
        type="button"
        aria-label="بازگشت"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
        className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sunken"
      >
        <ArrowRight className="size-5" />
      </button>
      <div className="min-w-0 flex-1">
        {title ? <h1 className="truncate text-[15px] font-bold">{title}</h1> : null}
        {subtitle ? <p className="truncate text-[11px] text-muted">{subtitle}</p> : null}
      </div>
      {actions}
      {share ? (
        <button
          type="button"
          aria-label="اشتراک‌گذاری"
          className="grid size-10 place-items-center rounded-full hover:bg-sunken"
          onClick={async () => {
            const url = window.location.href;
            try {
              if (navigator.share) await navigator.share({ url, title: document.title });
              else {
                await navigator.clipboard.writeText(url);
                toast.success("لینک کپی شد");
              }
            } catch {}
          }}
        >
          <Share2 className="size-5" />
        </button>
      ) : null}
    </header>
  );
}
