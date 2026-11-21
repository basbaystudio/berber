import Link from "next/link";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listPackages, listServices } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { PackageForm } from "@/components/panel/catalog-forms";
import { formatTL } from "@/lib/money";
import { savePackageAction } from "./actions";

export const metadata = { title: "Paketler" };

export default async function PackagesPage() {
  const ctx = await requireBusinessPage();
  const [list, services, staff] = [await listPackages(db, ctx.businessId), await listServices(db, ctx.businessId), await listStaff(db, ctx.businessId)];
  return (
    <>
      <PageHeader title="Paketler" description="Birden fazla hizmeti tek fiyatla sunun (örn. saç kesimi + sakal + yıkama). Paketin tamamını tek çalışan yapar." />
      <Card className="mb-6">
        <CardHeader title="Yeni paket" />
        <div className="p-6">
          <PackageForm action={savePackageAction.bind(null, null)} services={services.filter((s) => s.isActive)} staff={staff} />
        </div>
      </Card>
      <Card>
        {list.length === 0 ? (
          <EmptyState title="Henüz paket yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((p) => (
              <li key={p.id}>
                <Link href={`/isletme/panel/paketler/${p.id}`} className="flex flex-wrap items-center gap-3 px-6 py-4 hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-stone-900">{p.name}</p>
                    <p className="text-sm text-stone-500">
                      {p.items.map((i) => i.name).join(" + ")} · {p.durationMin} dk · {p.staffIds.length} çalışan
                    </p>
                  </div>
                  <span className="font-medium tabular-nums text-stone-900">{formatTL(p.priceKurus)}</span>
                  {!p.isActive && <Badge>Pasif</Badge>}
                  {p.staffIds.length === 0 && <Badge tone="amber">Çalışan atanmadı</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
