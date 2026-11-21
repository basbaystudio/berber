import { connection } from "next/server";
import { Scissors } from "lucide-react";
import { db } from "@/server/db/client";
import { getActiveBanners } from "@/server/modules/admin/banners";
import { BannerCarousel } from "@/components/marketplace/banner-carousel";

/** Pazaryeri ana sayfası. Arama, filtreler ve berber listeleri Aşama 5'te eklenecek. */
export default async function HomePage() {
  await connection(); // bannerlar yayın tarihine bağlı: her istekte güncel
  const banners = await getActiveBanners(db);
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-5 sm:px-6">
        <span className="grid size-8 place-items-center rounded-xl bg-stone-900 text-white">
          <Scissors className="size-4" aria-hidden />
        </span>
        <span className="font-semibold tracking-tight text-stone-900">Berber Randevu</span>
      </header>
      <main className="mx-auto max-w-6xl space-y-10 px-4 pb-16 sm:px-6">
        <BannerCarousel banners={banners} />
        <section className="mx-auto max-w-2xl space-y-3 py-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Yakınındaki berberi bul, boş saati gör, randevunu al.</h1>
          <p className="text-stone-500">Berber keşfi ve online randevu çok yakında burada.</p>
        </section>
      </main>
    </div>
  );
}
