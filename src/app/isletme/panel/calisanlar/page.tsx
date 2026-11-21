import Link from "next/link";
import { UserRound } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listStaff } from "@/server/modules/business/staff";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { NewStaffForm } from "./forms";
import { createStaffAction } from "./actions";

export const metadata = { title: "Çalışanlar" };

export default async function StaffListPage() {
  const ctx = await requireBusinessPage();
  const list = await listStaff(db, ctx.businessId);
  return (
    <>
      <PageHeader title="Çalışanlar" description="Çalışanlarınızın giriş hesabı yoktur; bilgilerini, vardiyalarını ve verdikleri hizmetleri siz yönetirsiniz." />
      <Card className="mb-6">
        <CardHeader title="Yeni çalışan" />
        <div className="p-6">
          <NewStaffForm action={createStaffAction} />
        </div>
      </Card>
      <Card>
        {list.length === 0 ? (
          <EmptyState title="Henüz çalışan yok" description="İlk çalışanınızı ekleyin; ardından vardiyasını ve verdiği hizmetleri tanımlayın." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((s) => (
              <li key={s.id}>
                <Link href={`/isletme/panel/calisanlar/${s.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-stone-50">
                  {s.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photoUrl} alt="" className="size-11 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-11 place-items-center rounded-full bg-stone-100 text-stone-500">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-stone-900">{s.name}</p>
                    <p className="text-sm text-stone-500">
                      {s.title ? `${s.title} · ` : ""}
                      {s.serviceIds.length} hizmet
                    </p>
                  </div>
                  {s.isActive ? <Badge tone="green">Aktif</Badge> : <Badge>Pasif</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
