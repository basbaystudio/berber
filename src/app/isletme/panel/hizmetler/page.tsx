import Link from "next/link";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listActiveServiceTypes, listServices } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ServiceForm } from "@/components/panel/catalog-forms";
import { formatTL } from "@/lib/money";
import { saveServiceAction } from "./actions";

export const metadata = { title: "Hizmetler" };

export default async function ServicesPage() {
  const ctx = await requireBusinessPage();
  const [list, types, staff] = [await listServices(db, ctx.businessId), await listActiveServiceTypes(db), await listStaff(db, ctx.businessId)];
  return (
    <>
      <PageHeader title="Hizmetler" description="Fiyat ve süreler randevu hesaplamasında kullanılır." />
      <Card className="mb-6">
        <CardHeader title="Yeni hizmet" />
        <div className="p-6">
          <ServiceForm action={saveServiceAction.bind(null, null)} types={types} staff={staff} />
        </div>
      </Card>
      <Card>
        {list.length === 0 ? (
          <EmptyState title="Henüz hizmet yok" description="Sunduğunuz hizmetleri fiyat ve süreleriyle ekleyin." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={`/isletme/panel/hizmetler/${s.id}`} className="flex flex-wrap items-center gap-3 px-6 py-4 hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">{s.name}</p>
                    <p className="text-sm text-stone-500">
                      {s.durationMin} dk · {s.staffIds.length} çalışan{s.typeName ? ` · ${s.typeName}` : ""}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-stone-900">{formatTL(s.priceKurus)}</span>
                  {!s.isActive && <Badge>Pasif</Badge>}
                  {s.staffIds.length === 0 && <Badge tone="amber">Çalışan atanmadı</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
