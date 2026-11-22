import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/site";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Dijital Berber — Online Berber Randevusu", template: "%s · Dijital Berber" },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: SITE_NAME,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Dijital Berber — online berber randevusu" }],
  },
  twitter: { card: "summary_large_image" },
  // Google Search Console doğrulaması: Vercel'e GOOGLE_SITE_VERIFICATION eklenince otomatik çıkar
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
  applicationName: "Dijital Berber",
  appleWebApp: { capable: true, title: "Dijital Berber", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#001d48",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
