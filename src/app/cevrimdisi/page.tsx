import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bağlantı yok", robots: { index: false } };
export const dynamic = "force-static";

/** Service worker'ın önbelleğe aldığı çevrimdışı sayfası. Bağımsız ve statik olmalı. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm space-y-4">
        <p className="text-sm font-medium uppercase tracking-wide text-stone-500">Çevrimdışı</p>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">İnternet bağlantısı yok</h1>
        <p className="text-stone-600">Randevu bilgileri her zaman güncel olmalı; bu yüzden sayfalar bağlantı olmadan gösterilmez. Bağlantınız gelince tekrar deneyin.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="inline-flex rounded-xl bg-brand-900 px-5 py-2.5 text-sm font-medium text-white">
          Tekrar dene
        </a>
      </div>
    </main>
  );
}
