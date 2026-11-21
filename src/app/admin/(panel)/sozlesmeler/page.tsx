import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listContractsWithStats } from "@/server/modules/admin/contracts";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { NewContractForm } from "./forms";
import { createContractAction } from "./actions";

export const metadata = { title: "Sözleşmeler" };

export default async function ContractsAdminPage() {
  await requireAdminPage();
  const list = await listContractsWithStats(db);
  return (
    <>
      <PageHeader title="Sözleşmeler" description="Yayınladığınız ya da güncellediğiniz sözleşmeler işletmelerin paneline ve bildirimlerine düşer; işletmeler onaylar." />
      <Card className="mb-6">
        <CardHeader title="Yeni sözleşme" />
        <div className="p-6">
          <NewContractForm action={createContractAction} />
        </div>
      </Card>
      <Card>
        {list.length === 0 ? (
          <EmptyState title="Henüz sözleşme yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/sozlesmeler/${c.id}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-stone-50">
                  <div>
                    <p className="font-medium text-stone-900">{c.title}</p>
                    <p className="text-sm text-stone-500">{c.latest ? `Sürüm ${c.latest.version} · ${formatDateTime(c.latest.published_at)}` : "Henüz yayınlanmadı"}</p>
                  </div>
                  {c.latest ? (
                    <Badge tone={c.accepted === c.totalBusinesses ? "green" : "amber"}>
                      {c.accepted}/{c.totalBusinesses} işletme onayladı
                    </Badge>
                  ) : (
                    <Badge>Taslak</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
