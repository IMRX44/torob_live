import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ترب حضوری، دستیار خرید حضوری",
    short_name: "ترب حضوری",
    description: "پیدا کن، مقایسه کن، از فروشنده بپرس و حضوری بخر.",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "fa",
    background_color: "#faf8f5",
    theme_color: "#e5383b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
