import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * İçerik Güvenliği Politikası. Next.js satır içi başlatma betikleri kullandığı için script-src'de
 * 'unsafe-inline' gerekir (nonce kullanımı tüm sayfaları dinamik yapar ve önbelleği kapatır).
 * Asıl kazanım: dış kaynaklı betik/çerçeve/form hedefi yasak; görseller yalnızca bilinen kaynaklardan.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "pg", "sharp"],
  poweredByHeader: false,
  experimental: {
    // Görseller istemcide küçültülüp gönderilir; Vercel istek sınırı 4,5 MB
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  async redirects() {
    // Eski giriş adresleri → yeni sade adresler
    return [
      { source: "/admin/giris", destination: "/admin", permanent: true },
      { source: "/isletme/giris", destination: "/isletme", permanent: true },
      { source: "/isletme/giris/:slug", destination: "/isletme/:slug", permanent: true },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
