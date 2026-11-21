import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listServiceTypes } from "@/server/modules/admin/service-types";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { createServiceTypeAction, updateServiceTypeAction } from "./actions";
import { ServiceTypeRowForm } from "./forms";

export const metadata = { title: "Hizmet Türleri" };

export default async function ServiceTypesPage() {
  await requireAdminPage();
  const types = await listServiceTypes(db);
  return (
    <>
      <PageHeader
        title="Hizmet türleri"
        description="Pazaryerindeki hizmet filtresi bu türlere göre çalışır. İşletmeler kendi hizmetlerini bu türlerle eşleştirir."
      />
      <Card className="mb-6">
        <CardHeader title="Yeni hizmet türü" />
        <div className="p-5">
          <ServiceTypeRowForm action={createServiceTypeAction} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Mevcut türler" description="Pasif türler yeni hizmetlerde ve filtrelerde gösterilmez." />
        {types.length === 0 ? (
          <EmptyState title="Henüz hizmet türü yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {types.map((t) => (
              <li key={t.id} className="px-5 py-3">
                <ServiceTypeRowForm action={updateServiceTypeAction.bind(null, t.id)} defaults={{ name: t.name, sortOrder: t.sortOrder, isActive: t.isActive }} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
