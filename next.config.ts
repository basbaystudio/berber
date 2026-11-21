import type { NextConfig } from "next";

const securityHeaders = [
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
