import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/Store";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";
import { ServiceWorker } from "@/components/ServiceWorker";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${t.appName} — ${t.appTagline}`,
  description:
    "Llogaritësi 90/180 për zonën Schengen. Punon pa internet, të dhënat nuk dalin nga pajisja.",
  manifest: "/manifest.webmanifest",
  applicationName: t.appName,
  appleWebApp: { capable: true, statusBarStyle: "default", title: t.appName },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, date: false, address: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sq">
      <body className="min-h-dvh">
        <StoreProvider>
          <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
            <main className="flex-1 px-4 pb-40 pt-5">{children}</main>
            <Disclaimer />
            <Nav />
          </div>
        </StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
