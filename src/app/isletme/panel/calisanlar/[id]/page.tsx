import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { getStaffDetail } from "@/server/modules/business/staff";
import { listServices } from "@/server/modules/business/catalog";
import { getWeeklyHours } from "@/server/modules/business/hours";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateTime } from "@/lib/time";
import { StaffInfoForm, StaffPhotoForm, StaffServicesForm, StaffWeeklyForm, TimeOffForm } from "../forms";
import {
  addTimeOffAction,
  deleteStaffAction,
  deleteTimeOffAction,
  staffPhotoAction,
  staffServicesAction,
  staffWeeklyAction,
  updateStaffAction,
} from "../actions";

export const metadata = { title: "Çalışan" };

const OFF = { LEAVE: "İzin", SICK: "Rapor", BLOCK: "Saat kapatma" } as const;

export default async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ yeni?: string }> }) {
  const ctx = await requireBusinessPage();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let s;
  try {
    s = await getStaffDetail(db, ctx.businessId, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const [services, businessHours] = [await listServices(db, ctx.businessId), await getWeeklyHours(db, ctx.businessId)];
  const noShift = Object.keys(s.shifts).length === 0;

  return (
    <>
      <Link href="/isletme/panel/calisanlar" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Çalışanlar
      </Link>
      <PageHeader title={s.name} description={s.title ?? undefined} actions={s.isActive ? <Badge tone="green">Aktif</Badge> : <Badge>Pasif</Badge>} />
      {sp.yeni && (
        <Alert tone="success" className="mb-6" title="Çalışan eklendi">
          Şimdi verdiği hizmetleri ve vardiyasını tanımlayın; aksi halde randevu alamaz.
        </Alert>
      )}
      {!sp.yeni && (noShift || s.serviceIds.length === 0) && (
        <Alert tone="warning" className="mb-6">
          {noShift ? "Vardiya tanımlanmadı. " : ""}
          {s.serviceIds.length === 0 ? "Verdiği hizmet seçilmedi. " : ""}Bu çalışan bu haliyle randevu alamaz.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Verdiği hizmetler" description="Müşteri bu hizmetleri seçtiğinde bu çalışan listelenir." />
            <div className="p-6">
              <StaffServicesForm action={staffServicesAction.bind(null, s.id)} services={services} selected={s.serviceIds} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Vardiya" description="İşletme saatleri dışında kalan vardiya kısmı randevuya açılmaz." />
            <div className="p-6">
              <StaffWeeklyForm action={staffWeeklyAction.bind(null, s.id, "shifts")} defaultValue={s.shifts} kind="shifts" businessHours={businessHours} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Molalar" description="Her hafta tekrarlanan molalar (örn. öğle arası). Bu saatlerde randevu verilmez." />
            <div className="p-6">
              <StaffWeeklyForm action={staffWeeklyAction.bind(null, s.id, "breaks")} defaultValue={s.breaks} kind="breaks" />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Bilgiler" />
            <div className="space-y-6 p-6">
              <StaffPhotoForm action={staffPhotoAction.bind(null, s.id)} currentUrl={s.photoUrl} />
              <StaffInfoForm action={updateStaffAction.bind(null, s.id)} defaults={{ name: s.name, title: s.title, bio: s.bio, isActive: s.isActive }} />
            </div>
          </Card>
          <Card>
            <CardHeader title="İzinler" description="İzin, rapor veya tek seferlik saat kapatma" />
            <div className="border-b border-stone-100 p-6">
              <TimeOffForm action={addTimeOffAction.bind(null, s.id)} />
            </div>
            {s.timeOff.length === 0 ? (
              <p className="px-6 py-5 text-sm text-stone-500">Yaklaşan izin yok.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {s.timeOff.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                    <div>
                      <p className="text-stone-900">
                        {OFF[t.kind]} {t.note ? `· ${t.note}` : ""}
                      </p>
                      <p className="text-stone-500">
                        {formatDateTime(t.startsAt)} – {formatDateTime(t.endsAt)}
                      </p>
                    </div>
                    <ActionButton action={deleteTimeOffAction.bind(null, t.id)} variant="ghost">
                      Kaldır
                    </ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-6">
            <p className="mb-3 text-sm text-stone-600">Çalışan listeden kaldırılır; geçmiş randevu kayıtları korunur.</p>
            <ActionButton action={deleteStaffAction.bind(null, s.id)} variant="dangerOutline" confirm={`${s.name} silinsin mi?`}>
              Çalışanı sil
            </ActionButton>
          </Card>
        </div>
      </div>
    </>
  );
}
