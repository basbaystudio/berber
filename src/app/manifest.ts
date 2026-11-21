import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Berber Randevu",
    short_name: "Berber",
    description: "Yakınındaki berberleri keşfet, boş saatleri gör ve online randevu al.",
    lang: "tr",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#1c1917",
    categories: ["lifestyle", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Berber ara", url: "/ara" },
      { name: "Randevularım", url: "/hesabim/randevular" },
      { name: "İşletme paneli", url: "/isletme/panel" },
    ],
  };
}
