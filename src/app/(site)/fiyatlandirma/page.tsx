import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Check, Gift } from "lucide-react";
import { db } from "@/server/db/client";
import { getApplicationOffer } from "@/server/modules/applications";
import { formatTL } from "@/lib/money";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "Fiyatlandırma — Berberler için online randevu",
  description: "Dijital Berber fiyatları: aylık, yıllık ya da tek seferlik ödeme. İlk ay ücretsiz, randevu başına komisyon yok.",
  alternates: { canonical: "/fiyatlandirma" },
};

const COMMON = ["Pazaryerinde işletme profili", "Online randevu ve takvim", "Çalışan ve hizmet yönetimi", "Müşteri yorumları ve puanlama", "Randevu başına komisyon yok"];

export default async function PricingPage() {
  await connection();
  const offer = await getApplicationOffer(db);
  const plan = offer.plans.find((p) => p.isDefault) ?? offer.plans[0];
  const early = offer.early.remaining > 0;

  const options = plan
    ? [
        { key: "aylik", title: "Aylık", price: formatTL(plan.monthly), unit: "/ ay", note: "İstediğiniz zaman değiştirin.", highlight: false },
        ...(plan.yearly != null
          ? [
              {
                key: "yillik",
                title: "Yıllık",
                price: formatTL(plan.yearly),
                unit: "/ yıl",
                note: plan.monthly * 12 > plan.yearly ? `Aylığa göre yılda ${formatTL(plan.monthly * 12 - plan.yearly)} tasarruf.` : "12 ay tek ödeme.",
                highlight: true,
              },
            ]
          : []),
        ...(plan.lifetime != null
          ? [{ key: "tek-seferlik", title: "Tek seferlik", price: formatTL(plan.lifetime), unit: "bir kez", note: "Bir kez ödeyin, süresiz kullanın. Aylık ya da yıllık ücret yok.", highlight: false }]
          : []),
      ]
    : [];

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 pb-16 pt-8 sm:px-6">
      <header className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-accent-600">Fiyatlandırma</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">Size uyan ödemeyi seçin</h1>
        <p className="mx-auto max-w-xl text-stone-600">Tüm seçeneklerde aynı özellikler. Fiyatlara KDV dahildir. Ücretsiz süre boyunca kart bilgisi istenmez, ödeme alınmaz.</p>
        <p className="inline-flex items-center gap-2 rounded-full bg-accent-600 px-4 py-1.5 text-sm font-semibold text-white">
          <Gift className="size-4" aria-hidden />
          {early ? `İlk ${offer.early.limit} işletmeye ${offer.early.months} ay ücretsiz · kalan ${offer.early.remaining}` : `${offer.defaultTrialMonths} ay ücretsiz`}
        </p>
      </header>

      {options.length === 0 ? (
        <p className="text-center text-stone-600">Fiyatlar yakında burada olacak.</p>
      ) : (
        <ul className={cn("grid gap-4", options.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
          {options.map((o) => (
            <li
              key={o.key}
              className={cn("flex flex-col gap-5 rounded-3xl border bg-white p-6 sm:p-8", o.highlight ? "border-2 border-brand-900" : "border-stone-200/80")}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-stone-900">{o.title}</h2>
                {o.highlight && <span className="rounded-full bg-brand-900 px-2.5 py-0.5 text-xs font-semibold text-white">Avantajlı</span>}
              </div>
              <p>
                <span className="text-4xl font-bold tracking-tight text-stone-900">{o.price}</span>
                <span className="text-stone-600"> {o.unit}</span>
                <span className="block text-xs text-stone-500">KDV dahil</span>
              </p>
              <p className="text-sm text-stone-600">{o.note}</p>
              <ul className="space-y-2 text-sm text-stone-700">
                {COMMON.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden /> {c}
                  </li>
                ))}
              </ul>
              <Link
                href={`/basvuru?donem=${o.key}`}
                className={cn(
                  "mt-auto inline-flex h-11 items-center justify-center rounded-xl px-5 font-semibold",
                  o.highlight ? "bg-brand-900 text-white hover:bg-brand-800" : "border border-stone-300 text-stone-900 hover:bg-stone-100",
                )}
              >
                {o.title} ile başvur
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="text-center text-sm text-stone-500">
        Fiyatlara KDV dahildir. Kartla otomatik ödeme ya da havale / EFT ile ödeyebilirsiniz. Sorularınız için başvuru formunu doldurun, sizi arayalım.
      </p>
    </main>
  );
}
