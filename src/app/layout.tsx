import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "@/components/pwa/register-sw";

export const metadata: Metadata = {
  title: { default: "Dijital Berber", template: "%s · Dijital Berber" },
  description: "Yakınındaki berberleri keşfet, boş saatleri gör ve online randevu al.",
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
