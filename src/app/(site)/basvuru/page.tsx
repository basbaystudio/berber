import type { Metadata } from "next";
import { connection } from "next/server";
import { Gift, Percent, Sparkles } from "lucide-react";
import { db } from "@/server/db/client";
import { getApplicationOffer } from "@/server/modules/applications";
import { getLocations } from "@/server/modules/reference/locations";
import { ApplicationForm } from "./application-form";
import { submitApplicationAction } from "./actions";

export const metadata: Metadata = {
  title: "İşletmeni ekle — Berberler için online randevu",
  description: "Berber dükkanınızı Dijital Berber'e ekleyin: online randevu, takvim ve yeni müşteri. İlk ay ücretsiz, komisyon yok.",
  alternates: { canonical: "/basvuru" },
};

const DONEM = { aylik: "MONTHLY", yillik: "YEARLY", "tek-seferlik": "LIFETIME" } as const;

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ donem?: string }> }) {
  const { donem } = await searchParams;
  const initialCycle = donem && donem in DONEM ? DONEM[donem as keyof typeof DONEM] : undefined;
  await connection();
  const [offer, locations] = [await getApplicationOffer(db), await getLocations()];
  const early = offer.early.remaining > 0;
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8 sm:px-6">
      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">Berberler için</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">İşletmenizi Dijital Berber'e ekleyin</h1>
        <p className="text-stone-600">
          Türkiye'nin her yerinden başvurabilirsiniz. Formu doldurun, paketinizi seçin; sizi arayıp kurulumu birlikte yapalım.
        </p>
      </header>

      <section
        aria-label="Kampanya"
        className={early ? "space-y-4 rounded-3xl bg-brand-900 p-6 text-white sm:p-8" : "space-y-2 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8"}
      >
        {early ? (
          <>
            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
              İlk {offer.early.limit} işletmeye <span className="text-accent-500">{offer.early.months} ay ücretsiz</span>
            </p>
            <p className="text-sm text-brand-100">
              Kalan kontenjan: <b className="text-white">{offer.early.remaining}</b> / {offer.early.limit}. Ücretsiz süre, başvurunuz onaylandığındaki sıranıza göre tanımlanır; kontenjan dolarsa {offer.defaultTrialMonths} ay ücretsiz.
            </p>
            <ul className="grid gap-3 pt-1 text-sm sm:grid-cols-3">
              <li className="flex items-center gap-2"><Gift className="size-4 text-accent-500" aria-hidden /> {offer.early.months} ay ücretsiz kullanım</li>
              <li className="flex items-center gap-2"><Sparkles className="size-4 text-accent-500" aria-hidden /> İlk ay 2 kampanya tasarımı</li>
              <li className="flex items-center gap-2"><Percent className="size-4 text-accent-500" aria-hidden /> Randevu başına komisyon yok</li>
            </ul>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold text-stone-900">
              Herkese <span className="text-accent-600">ilk {offer.defaultTrialMonths} ay ücretsiz</span>: deneyin, sonra karar verin.
            </p>
            <p className="text-sm text-stone-600">Randevu başına komisyon yok. Ücretsiz süre bitmeden ödeme alınmaz.</p>
          </>
        )}
      </section>

      {offer.plans.length === 0 ? (
        <p className="text-stone-600">Başvurular şu an kapalı. Lütfen daha sonra tekrar deneyin.</p>
      ) : (
        <ApplicationForm action={submitApplicationAction} plans={offer.plans} locations={locations} freeMonths={offer.currentFreeMonths} initialCycle={initialCycle} />
      )}
    </main>
  );
}
