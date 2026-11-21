import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Berber Randevu", template: "%s · Berber Randevu" },
  description: "Yakınındaki berberleri keşfet, boş saatleri gör ve online randevu al.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e293b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
