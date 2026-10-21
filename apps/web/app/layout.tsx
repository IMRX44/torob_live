import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ترب حضوری، دستیار خرید حضوری", template: "%s، ترب حضوری" },
  description: "پیدا کن، مقایسه کن، از فروشنده بپرس و بدون دست‌خالی برگشتن، حضوری بخر. دستیار هوشمند خرید از فروشگاه‌ها و پاساژهای تهران.",
  applicationName: "ترب حضوری",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ترب حضوری", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c22" },
  ],
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <Toaster position="top-center" dir="rtl" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-sans)" } }} />
      </body>
    </html>
  );
}
