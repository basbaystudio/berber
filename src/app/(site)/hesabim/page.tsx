import Link from "next/link";
import { requireCustomer } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listMyAppointments } from "@/server/modules/customer/account";
import { Alert, Card } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/panel/appointment-status";
import { formatDateTime } from "@/lib/time";

export default async function AccountHome({ searchParams }: { searchParams: Promise<{ kayit?: string }> }) {
  const ctx = await requireCustomer();
  const sp = await searchParams;
  const { upcoming } = await listMyAppointments(db, ctx.customer.id);
  return (
    <div className="space-y-6">
      {sp.kayit && <Alert tone="success">Hesabınız oluşturuldu. E-postanızı doğruladıktan sonra randevu alabilirsiniz.</Alert>}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900">Yaklaşan randevularınız</h2>
          <ButtonLink href="/ara" variant="outline" size="sm">
            Yeni randevu al
          </ButtonLink>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Yaklaşan randevunuz yok.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {upcoming.slice(0, 3).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span>
                  <Link href={`/berber/${a.businessSlug}`} className="font-medium text-stone-900 hover:text-accent-600">
                    {a.businessName}
                  </Link>
                  <span className="block text-stone-500">
                    {formatDateTime(a.startsAt)} · {a.services}
                  </span>
                </span>
                <AppointmentStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
        {upcoming.length > 0 && (
          <Link href="/hesabim/randevular" className="mt-2 inline-block text-sm text-stone-600 underline underline-offset-4">
            Tüm randevularım
          </Link>
        )}
      </Card>
    </div>
  );
}
