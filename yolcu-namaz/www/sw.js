// Uygulama dosyalarını önbelleğe alır; bildirimleri gösterir.
const CACHE = "yolcu-namaz-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "prayer.js", "manifest.webmanifest", "icon.svg",
  "vendor/leaflet/leaflet.css",
  "vendor/leaflet/leaflet.js"];
const TILE_CACHE = "yolcu-namaz-tiles";
const TILE_MAX = 1500;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k !== CACHE && k !== TILE_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "tile.openstreetmap.org") {
    // Harita parçaları: önce internet, yoksa daha önce görülen parça
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(TILE_CACHE).then(async (c) => {
          await c.put(e.request, copy);
          const keys = await c.keys();
          for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
        });
      }
      return res;
    }).catch(() => caches.match(e.request)));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })));
  }
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then((cs) => cs.length ? cs[0].focus() : self.clients.openWindow("./")));
});
