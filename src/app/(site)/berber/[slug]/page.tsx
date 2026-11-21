import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Award, Clock, MapPin, Phone } from "lucide-react";
import { db } from "@/server/db/client";
import { getCustomer } from "@/server/auth/guards";
import { getPublicProfile } from "@/server/modules/marketplace/profile";
import { Stars } from "@/components/marketplace/business-card";
import { Gallery } from "@/components/marketplace/gallery";
import { FavoriteButton } from "@/components/marketplace/favorite-button";
import { StaticMap } from "@/components/map/static-map";
import { ButtonLink } from "@/components/ui/button";
import { formatTL } from "@/lib/money";
import { formatTrPhone } from "@/lib/phone";
import { WEEKDAYS } from "@/lib/schedule";
import { formatDateStr } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { toggleFavoriteAction } from "../actions";

const monthLabel = (m: string) => new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(db, slug);
  if (!p) return { title: "Berber bulunamadı" };
  return {
    title: `${p.name} · ${p.district}, ${p.province}`,
    description: p.description?.slice(0, 160) ?? `${p.name} — hizmetler, fiyatlar, boş saatler ve online randevu.`,
    openGraph: { images: p.coverUrl ? [p.coverUrl] : undefined },
  };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function BusinessProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const customer = await getCustomer();
  const p = await getPublicProfile(db, slug, customer?.customer.id);
  if (!p) notFound();
  const book = `/berber/${p.slug}/randevu`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    name: p.name,
    telephone: p.phone,
    address: { "@type": "PostalAddress", streetAddress: p.addressLine, addressLocality: p.district, addressRegion: p.province, addressCountry: "TR" },
    ...(p.latitude != null ? { geo: { "@type": "GeoCoordinates", latitude: p.latitude, longitude: p.longitude } } : {}),
    ...(p.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.ratingAvg.toFixed(1), reviewCount: p.ratingCount } } : {}),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="relative overflow-hidden rounded-3xl bg-stone-200">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt="" className="aspect-[3/1] w-full object-cover sm:aspect-[4/1]" />
        ) : (
          <div className="aspect-[3/1] w-full bg-gradient-to-br from-stone-200 to-stone-300 sm:aspect-[4/1]" />
        )}
      </div>
      <header className="flex flex-col gap-3 px-2 sm:flex-row sm:items-end sm:gap-4 sm:px-6">
        {p.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.logoUrl} alt="" className="-mt-10 size-20 shrink-0 rounded-3xl border-4 border-stone-50 object-cover" />
        ) : (
          <span className="-mt-10 grid size-20 shrink-0 place-items-center rounded-3xl border-4 border-stone-50 bg-stone-900 text-2xl font-semibold text-white">{p.name.slice(0, 1)}</span>
        )}
        <div className="min-w-0 flex-1 space-y-1 pb-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">{p.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
            <Stars value={p.ratingAvg} count={p.ratingCount} size="md" />
            <span className={cn("inline-flex items-center gap-1.5", p.open.isOpen ? "text-emerald-700" : "text-stone-500")}>
              <span className={cn("size-2 rounded-full", p.open.isOpen ? "bg-emerald-500" : "bg-stone-300")} aria-hidden />
              {p.open.label}
              {p.open.detail ? ` · ${p.open.detail}` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {p.district}, {p.province}
            </span>
          </div>
        </div>
      </header>
      {p.awards.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 px-2 sm:px-6">
          {p.awards.slice(0, 3).map((m) => (
            <span key={m} className="inline-flex items-center gap-1.5 rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-sm text-stone-800">
              <Award className="size-4 text-accent-600" aria-hidden /> Ayın İşletmesi — {monthLabel(m)}
            </span>
          ))}
        </div>
      )}
      {p.tempClosedNote && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{p.tempClosedNote}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-12">
          <nav className="flex gap-4 overflow-x-auto border-b border-stone-200 text-sm" aria-label="Profil bölümleri">
            {[
              ["hizmetler", "Hizmetler"],
              ...(p.photos.length ? [["galeri", "Galeri"]] : []),
              ...(p.staff.length ? [["ekip", "Ekip"]] : []),
              ["yorumlar", `Yorumlar (${p.ratingCount})`],
              ["bilgiler", "Bilgiler"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="shrink-0 border-b-2 border-transparent pb-3 text-stone-500 hover:border-stone-900 hover:text-stone-900">
                {label}
              </a>
            ))}
          </nav>

          <Section id="hizmetler" title="Hizmetler">
            {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-stone-600">{p.description}</p>}
            <ul className="divide-y divide-stone-100 rounded-3xl border border-stone-200/80 bg-white">
              {p.services.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">{s.name}</p>
                    <p className="text-sm text-stone-500">
                      {s.durationMin} dk{s.description ? ` · ${s.description}` : ""}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-stone-900">{formatTL(s.priceKurus)}</span>
                  <ButtonLink href={`${book}?h=${s.id}`} variant="outline" size="sm">
                    Seç
                  </ButtonLink>
                </li>
              ))}
            </ul>
            {p.packages.length > 0 && (
              <>
                <h3 className="pt-2 text-sm font-semibold text-stone-900">Paketler</h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {p.packages.map((k) => (
                    <li key={k.id} className="flex flex-col justify-between gap-3 rounded-3xl border border-stone-200/80 bg-white p-5">
                      <div>
                        <p className="font-medium text-stone-900">{k.name}</p>
                        <p className="text-sm text-stone-500">{k.items.join(" + ")}</p>
                        <p className="mt-1 text-sm text-stone-500">{k.durationMin} dk</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold tabular-nums text-stone-900">{formatTL(k.priceKurus)}</span>
                        <ButtonLink href={`${book}?p=${k.id}`} variant="outline" size="sm">
                          Seç
                        </ButtonLink>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          {p.photos.length > 0 && (
            <Section id="galeri" title="Galeri">
              <Gallery photos={p.photos} categories={p.categories} />
            </Section>
          )}

          {p.staff.length > 0 && (
            <Section id="ekip" title="Ekip">
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-4 rounded-3xl border border-stone-200/80 bg-white p-4">
                    {s.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.photoUrl} alt="" className="size-14 rounded-full object-cover" />
                    ) : (
                      <span className="grid size-14 place-items-center rounded-full bg-stone-100 font-semibold text-stone-500">{s.name.slice(0, 1)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-stone-900">{s.name}</p>
                      {s.title && <p className="text-sm text-stone-500">{s.title}</p>}
                      {s.bio && <p className="line-clamp-2 text-xs text-stone-500">{s.bio}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section id="yorumlar" title="Yorumlar">
            {p.reviews.length === 0 ? (
              <p className="text-sm text-stone-500">Henüz yorum yok. Yorumlar yalnızca bu işletmeden randevu almış müşteriler tarafından yazılabilir.</p>
            ) : (
              <ul className="space-y-4">
                {p.reviews.map((r) => (
                  <li key={r.id} className="rounded-3xl border border-stone-200/80 bg-white p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-stone-900">{r.customerName}</span>
                      <span className="text-stone-500">{formatDateStr(r.createdAt.toISOString().slice(0, 10))}</span>
                    </div>
                    <p className="mt-1 text-accent-600" aria-label={`${r.rating} yıldız`}>
                      {"★".repeat(r.rating)}
                      <span className="text-stone-200">{"★".repeat(5 - r.rating)}</span>
                      {r.staffName && <span className="ml-2 text-xs text-stone-500">· {r.staffName}</span>}
                    </p>
                    {r.comment && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{r.comment}</p>}
                    {r.reply && (
                      <div className="mt-3 rounded-2xl bg-stone-50 p-3 text-sm">
                        <p className="text-xs font-medium text-stone-500">İşletmenin yanıtı</p>
                        <p className="mt-1 whitespace-pre-line text-stone-700">{r.reply}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="bilgiler" title="Bilgiler">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-stone-200/80 bg-white p-5">
                <p className="mb-3 flex items-center gap-2 font-medium text-stone-900">
                  <Clock className="size-4" aria-hidden /> Çalışma saatleri
                </p>
                <dl className="space-y-1.5 text-sm">
                  {WEEKDAYS.map((d) => (
                    <div key={d.value} className="flex justify-between gap-3">
                      <dt className="text-stone-500">{d.label}</dt>
                      <dd className="text-right tabular-nums text-stone-800">{(p.weekly[d.value] ?? []).map((r) => `${r.start}–${r.end}`).join(", ") || "Kapalı"}</dd>
                    </div>
                  ))}
                </dl>
                {Object.keys(p.exceptions).length > 0 && (
                  <div className="mt-4 border-t border-stone-100 pt-3 text-xs text-stone-500">
                    <p className="mb-1 font-medium">Yaklaşan özel günler</p>
                    {Object.entries(p.exceptions).map(([d, e]) => (
                      <p key={d}>
                        {formatDateStr(d)}: {e.kind === "CLOSED" ? "Kapalı" : e.ranges.map((r) => `${r.start}–${r.end}`).join(", ")}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="rounded-3xl border border-stone-200/80 bg-white p-5 text-sm">
                  <p className="text-stone-800">{p.addressLine}</p>
                  <p className="text-stone-500">
                    {p.district}, {p.province}
                  </p>
                  <a href={`tel:${p.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-stone-800 hover:text-accent-600">
                    <Phone className="size-4" aria-hidden /> {formatTrPhone(p.phone)}
                  </a>
                </div>
                {p.latitude != null && p.longitude != null && (
                  <>
                    <StaticMap lat={p.latitude} lng={p.longitude} />
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${p.latitude},${p.longitude}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-block text-sm text-stone-600 underline underline-offset-4 hover:text-stone-900"
                    >
                      Yol tarifi al
                    </a>
                  </>
                )}
              </div>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-3 rounded-3xl border border-stone-200/80 bg-white p-5">
            <p className="text-sm text-stone-600">Boş saatleri anında görün, birkaç adımda randevunuzu alın. Ödeme işletmede yapılır.</p>
            <ButtonLink href={book} size="lg" className="w-full">
              Randevu al
            </ButtonLink>
            <FavoriteButton initial={p.isFavorite} action={toggleFavoriteAction.bind(null, p.slug)} loginHref={`/giris?next=${encodeURIComponent(`/berber/${p.slug}`)}`} />
          </div>
        </aside>
      </div>
      {/* Mobilde sabit randevu butonu */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200/80 bg-white/95 p-3 backdrop-blur lg:hidden">
        <ButtonLink href={book} size="lg" className="w-full">
          Randevu al
        </ButtonLink>
      </div>
      <p className="mt-10 text-center text-xs text-stone-500">
        <Link href="/ara">Diğer berberlere göz atın</Link>
      </p>
    </main>
  );
}
