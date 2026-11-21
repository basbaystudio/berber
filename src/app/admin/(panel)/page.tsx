import Link from "next/link";
import { getAdmin } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getPlatformStats } from "@/server/modules/admin/stats";
import { listBusinesses } from "@/server/modules/admin/businesses";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { formatTL } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "./isletmeler/status-badge";

export const metadata = { title: "Gösterge Paneli" };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </Card>
  );
}

export default async function AdminDashboard() {
  // Oturum yoksa layout giriş ekranını gösterir; burada yönlendirme yapılmaz (döngü olmasın).
  if (!(await getAdmin())) return null;
  const [s, recent] = await Promise.all([getPlatformStats(db), listBusinesses(db, { page: 1 })]);
  return (
    <>
      <PageHeader
        title="Gösterge Paneli"
        description="Platformun genel durumu"
        actions={<ButtonLink href="/admin/isletmeler/yeni">Yeni işletme</ButtonLink>}
      />
      <section aria-label="İşletme istatistikleri" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam işletme" value={s.businesses.total} hint={`${s.businesses.published} yayında`} />
        <Stat label="Aktif işletme" value={s.businesses.active} />
        <Stat label="Taslak işletme" value={s.businesses.draft} hint="Henüz aktifleştirilmedi" />
        <Stat label="Askıdaki işletme" value={s.businesses.suspended} />
      </section>
      <section aria-label="Randevu ve gelir istatistikleri" className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Toplam müşteri" value={s.customers} />
        <Stat label="Bugünkü randevu" value={s.appointments.today} hint={`Bu ay ${s.appointments.thisMonth} · Bekleyen ${s.appointments.pending}`} />
        <Stat label="Bu ay randevu cirosu" value={formatTL(s.revenue.completedThisMonthKurus)} hint="Tamamlanan randevular" />
        <Stat label="Bu ay abonelik geliri" value={formatTL(s.revenue.subscriptionThisMonthKurus)} hint="Kaydedilen ödemeler" />
      </section>

      <Card className="mt-6">
        <CardHeader title="Son eklenen işletmeler" actions={<Link href="/admin/isletmeler" className="text-sm font-medium text-stone-900 underline-offset-4 hover:underline">Tümünü gör</Link>} />
        {recent.rows.length === 0 ? (
          <EmptyState
            title="Henüz işletme yok"
            description="İlk berber işletmesini oluşturarak başlayın. İşletme hesabını ve giriş bilgilerini siz tanımlarsınız."
            action={<ButtonLink href="/admin/isletmeler/yeni">İşletme oluştur</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {recent.rows.slice(0, 5).map((b) => (
              <li key={b.id}>
                <Link href={`/admin/isletmeler/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-stone-50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900">{b.name}</p>
                    <p className="text-sm text-stone-500">
                      {b.district}, {b.province} · {formatDateTime(b.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={b.status} published={b.isPublished} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
