import { Mail, Phone } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getProfile } from "@/server/modules/business/profile";
import { getSetting } from "@/server/modules/platform/settings";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { formatTrPhone } from "@/lib/phone";

export const metadata = { title: "İşletme Profili" };

/** Salt okunur: profil bilgilerini yalnızca platform yönetimi değiştirir. */
export default async function ProfilePage() {
  const ctx = await requireBusinessPage();
  const [p, contact] = [await getProfile(db, ctx), await getSetting(db, "platform.contact")];
  const rows: [string, React.ReactNode][] = [
    ["İşletme adı", p.name],
    ["Profil adresi", `/berber/${p.slug}`],
    ["Telefon", formatTrPhone(p.phone)],
    ["E-posta", p.email ?? "—"],
    ["Adres", `${p.addressLine}, ${p.districtName}/${p.provinceName}`],
    ["Harita konumu", p.latitude != null ? "Girilmiş" : "Girilmemiş"],
    ["Tanıtım", p.description || "—"],
  ];
  return (
    <>
      <PageHeader title="İşletme profili" description="Müşterilerin profilinizde göreceği bilgiler." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          {p.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.coverUrl} alt="" className="aspect-[20/7] w-full rounded-t-2xl object-cover" />
          )}
          <div className="flex items-center gap-4 border-b border-stone-100 px-6 py-5">
            {p.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.logoUrl} alt="" className="size-14 rounded-2xl object-cover" />
            ) : (
              <span className="grid size-14 place-items-center rounded-2xl bg-stone-100 text-lg font-semibold text-stone-500">{p.name.slice(0, 1)}</span>
            )}
            <p className="text-lg font-semibold text-stone-900">{p.name}</p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 p-6 text-sm sm:grid-cols-[auto_1fr]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-stone-500">{k}</dt>
                <dd className="whitespace-pre-line text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Bilgileri değiştirmek mi istiyorsunuz?" description="Profil bilgileri, logo ve kapak görseli platform yönetimi tarafından güncellenir." />
          <div className="space-y-3 p-6 text-sm">
            {contact.email || contact.phone ? (
              <>
                <p className="text-stone-600">Değişiklik talebiniz için bize ulaşın:</p>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-stone-900 hover:text-accent-600">
                    <Mail className="size-4 text-stone-400" aria-hidden /> {contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-stone-900 hover:text-accent-600">
                    <Phone className="size-4 text-stone-400" aria-hidden /> {contact.phone}
                  </a>
                )}
              </>
            ) : (
              <p className="text-stone-600">Değişiklik talebiniz için platform yönetimiyle iletişime geçin.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
