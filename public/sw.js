/*
 * Berber Randevu service worker.
 * İlke: randevu ve hesap verisi her zaman ağdan gelir; HTML ve API yanıtları ÖNBELLEĞE ALINMAZ
 * (paylaşılan cihazda kişisel veri kalmasın, eski müsaitlik gösterilmesin).
 * Önbellek yalnızca: değişmez derleme dosyaları (/_next/static), ikonlar ve çevrimdışı sayfası.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/cevrimdisi";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Sayfa geçişleri: her zaman ağ; ağ yoksa çevrimdışı sayfası
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())));
    return;
  }

  // Değişmez derleme dosyaları ve ikonlar: önce önbellek
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // Diğer her şey: tarayıcının varsayılan davranışı (önbelleğe alınmaz)
});
