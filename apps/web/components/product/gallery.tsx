"use client";
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function Gallery({ images: all, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<string[]>([]);
  const images = all.filter((s) => !broken.includes(s));
  if (!images.length)
    return (
      <div className="mx-4 grid aspect-[4/3] place-items-center rounded-[24px] bg-sunken text-subtle">
        <ImageOff className="size-10" />
      </div>
    );
  return (
    <div className="px-4">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto rounded-[24px] bg-white"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
      >
        {images.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt={`${alt} ${k + 1}`} onError={() => setBroken((b) => [...b, src])} loading={k ? "lazy" : "eager"} className="aspect-[4/3] w-full shrink-0 snap-center object-contain p-6 mix-blend-multiply" />
        ))}
      </div>
      {images.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5">
          {images.map((src, k) => (
            <span key={src} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-5 bg-fg" : "w-1.5 bg-line-strong")} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
