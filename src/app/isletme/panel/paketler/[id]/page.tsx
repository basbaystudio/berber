import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listPackages, listServices } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { PackageForm } from "@/components/panel/catalog-forms";
import { deletePackageAction, savePackageAction } from "../actions";

export const metadata = { title: "Paket" };

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBusinessPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const p = (await listPackages(db, ctx.businessId)).find((x) => x.id === id);
  if (!p) notFound();
  const [services, staff] = [await listServices(db, ctx.businessId), await listStaff(db, ctx.businessId)];
  return (
    <>
      <Link href="/isletme/panel/paketler" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Paketler
      </Link>
      <PageHeader title={p.name} />
      <Card className="mb-6">
        <CardHeader title="Paket bilgileri" />
        <div className="p-6">
          <PackageForm
            action={savePackageAction.bind(null, p.id)}
            services={services.filter((s) => s.isActive || p.items.some((i) => i.serviceId === s.id))}
            staff={staff}
            defaults={{ ...p, serviceIds: p.items.map((i) => i.serviceId) }}
          />
        </div>
      </Card>
      <Card className="p-6">
        <ActionButton action={deletePackageAction.bind(null, p.id)} variant="dangerOutline" confirm={`${p.name} silinsin mi?`}>
          Paketi sil
        </ActionButton>
      </Card>
    </>
  );
}
