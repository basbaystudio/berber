import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listActiveServiceTypes, listServices } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { ServiceForm } from "@/components/panel/catalog-forms";
import { deleteServiceAction, saveServiceAction } from "../actions";

export const metadata = { title: "Hizmet" };

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBusinessPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const s = (await listServices(db, ctx.businessId)).find((x) => x.id === id);
  if (!s) notFound();
  const [types, staff] = [await listActiveServiceTypes(db), await listStaff(db, ctx.businessId)];
  return (
    <>
      <Link href="/isletme/panel/hizmetler" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Hizmetler
      </Link>
      <PageHeader title={s.name} />
      <Card className="mb-6">
        <CardHeader title="Hizmet bilgileri" />
        <div className="p-6">
          <ServiceForm action={saveServiceAction.bind(null, s.id)} types={types} staff={staff} defaults={s} />
        </div>
      </Card>
      <Card className="p-6">
        <p className="mb-3 text-sm text-stone-600">Hizmet listeden kaldırılır; geçmiş randevu kayıtları korunur.</p>
        <ActionButton action={deleteServiceAction.bind(null, s.id)} variant="dangerOutline" confirm={`${s.name} silinsin mi?`}>
          Hizmeti sil
        </ActionButton>
      </Card>
    </>
  );
}
