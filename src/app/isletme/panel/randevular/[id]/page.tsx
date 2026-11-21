import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { z } from "zod";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { getAppointmentDetail } from "@/server/modules/booking/queries";
import { expireOverduePendings } from "@/server/modules/booking/service";
import { listServices, listPackages } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { AppointmentStatusBadge, CANCEL_REASON, STATUS_LABEL } from "@/components/panel/appointment-status";
import { formatTL } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { formatTrPhone } from "@/lib/phone";
import { todayTR } from "@/lib/dates";
import { CancelForm, NoteForm, RescheduleForm } from "./forms";
import { cancelAction, confirmAction, finalizeAction, getSlotsAction, internalNoteAction, rescheduleAction } from "../actions";

export const metadata = { title: "Randevu" };

const fmtTime = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ yeni?: string }> }) {
  const ctx = await requireBusinessPage();
  const { id } = await params;
  const sp = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await expireOverduePendings(db, { businessId: ctx.businessId });
  let d;
  try {
    d = await getAppointmentDetail(db, ctx.businessId, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const a = d.a;
  const now = new Date();
  const active = a.status === "PENDING" || a.status === "CONFIRMED";
  const started = a.startsAt <= now;
  const pkgId = d.items[0]?.packageId ?? undefined;
  const serviceIds = d.items.map((i) => i.serviceId).filter((x): x is string => !!x);
  // Değiştirmede yalnızca bu seçimi verebilen çalışanlar
  const [services, packages, staffAll] = [await listServices(db, ctx.businessId), await listPackages(db, ctx.businessId), await listStaff(db, ctx.businessId)];
  const eligible = pkgId
    ? (packages.find((p) => p.id === pkgId)?.staffIds ?? [])
    : staffAll.map((s) => s.id).filter((sid) => serviceIds.every((x) => services.find((s) => s.id === x)?.staffIds.includes(sid)));
  const staffOpts = staffAll.filter((s) => s.isActive && (eligible.includes(s.id) || s.id === a.staffId)).map((s) => ({ id: s.id, name: s.name }));

  return (
    <>
      <Link href="/isletme/panel/randevular" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Randevular
      </Link>
      <PageHeader
        title={`${d.bc.displayName} · ${fmtTime.format(a.startsAt)}`}
        description={`${formatDateTime(a.startsAt)} – ${fmtTime.format(a.endsAt)} · ${d.staffName}`}
        actions={<AppointmentStatusBadge status={a.status} />}
      />
      {sp.yeni && (
        <Alert tone="success" className="mb-6">
          Randevu oluşturuldu.
        </Alert>
      )}
      {a.status === "PENDING" && a.confirmDeadline && (
        <Alert tone="warning" className="mb-6" title="Onayınızı bekliyor">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> Son onay zamanı: {formatDateTime(a.confirmDeadline)}. Süresi içinde onaylanmazsa otomatik iptal olur ve güven puanınız düşer.
          </span>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="İşlemler" />
            <div className="flex flex-wrap gap-2 p-6">
              {a.status === "PENDING" && (
                <>
                  <ActionButton action={confirmAction.bind(null, a.id)} variant="primary">
                    Onayla
                  </ActionButton>
                  <CancelForm action={cancelAction.bind(null, a.id)} label="Reddet" />
                </>
              )}
              {a.status === "CONFIRMED" && started && (
                <>
                  <ActionButton action={finalizeAction.bind(null, a.id, "COMPLETED")} variant="primary">
                    Tamamlandı
                  </ActionButton>
                  <ActionButton action={finalizeAction.bind(null, a.id, "NO_SHOW")} confirm="Müşteri gelmedi olarak işaretlensin mi?">
                    Gelmedi
                  </ActionButton>
                </>
              )}
              {a.status === "CONFIRMED" && <CancelForm action={cancelAction.bind(null, a.id)} label="Randevuyu iptal et" />}
              {!active && a.status !== "CONFIRMED" && <p className="text-sm text-stone-500">Bu randevu için yapılacak işlem yok.</p>}
              {a.status === "CONFIRMED" && !started && <p className="w-full text-xs text-stone-500">Tamamlandı/Gelmedi işaretlemesi randevu saatinden sonra yapılabilir.</p>}
            </div>
          </Card>
          {active && (
            <Card>
              <CardHeader title="Tarih / saat değiştir" description={a.source === "ONLINE" ? "Müşteriye e-postayla bildirilir." : undefined} />
              <div className="p-6">
                <RescheduleForm
                  action={rescheduleAction.bind(null, a.id)}
                  fetchSlots={getSlotsAction}
                  serviceIds={pkgId ? [] : serviceIds}
                  packageId={pkgId}
                  staff={staffOpts}
                  currentStaffId={a.staffId}
                  today={todayTR()}
                  defaultDate={fmtDate.format(a.startsAt) < todayTR() ? todayTR() : fmtDate.format(a.startsAt)}
                  appointmentId={a.id}
                />
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Geçmiş" />
            <ul className="divide-y divide-stone-100">
              {d.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 px-6 py-2.5 text-sm">
                  <span className="text-stone-700">
                    {STATUS_LABEL[e.toStatus]}
                    {e.actorRealm === "CUSTOMER" ? " · müşteri" : e.actorRealm === "BUSINESS" ? " · işletme" : !e.actorRealm ? " · sistem" : ""}
                    {e.note ? <span className="text-stone-500"> · {e.note.startsWith("Yeni zaman") ? "Zaman değişti" : e.note}</span> : null}
                  </span>
                  <span className="shrink-0 text-stone-500">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Hizmetler" />
            <ul className="divide-y divide-stone-100 text-sm">
              {d.items.map((i) => (
                <li key={i.id} className="flex justify-between px-6 py-2.5">
                  <span>
                    {i.nameSnapshot} <span className="text-stone-500">· {i.durationSnapshotMin} dk</span>
                  </span>
                  <span className="tabular-nums">{formatTL(i.priceSnapshotKurus)}</span>
                </li>
              ))}
              <li className="flex justify-between px-6 py-2.5 font-medium">
                <span>Toplam (işletmede ödenir)</span>
                <span className="tabular-nums">{formatTL(a.totalKurus)}</span>
              </li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="Müşteri" />
            <div className="space-y-1 p-6 text-sm">
              <Link href={`/isletme/panel/musteriler/${d.bc.id}`} className="font-medium text-stone-900 hover:text-accent-600">
                {d.bc.displayName}
              </Link>
              {d.bc.phone && (
                <p>
                  <a href={`tel:${d.bc.phone}`} className="text-stone-600 hover:text-stone-900">
                    {formatTrPhone(d.bc.phone)}
                  </a>
                </p>
              )}
              <p className="text-stone-500">{a.source === "ONLINE" ? "Online randevu (üye)" : "Panelden oluşturuldu"}</p>
              {a.customerNote && <p className="mt-2 rounded-xl bg-stone-50 p-3 text-stone-700">Müşteri notu: {a.customerNote}</p>}
              {a.status === "CANCELLED" && a.cancelReason && (
                <p className="mt-2 text-stone-500">
                  {CANCEL_REASON[a.cancelReason]}
                  {a.cancelNote ? ` · ${a.cancelNote}` : ""}
                </p>
              )}
            </div>
          </Card>
          <Card>
            <CardHeader title="İç not" />
            <div className="p-6">
              <NoteForm action={internalNoteAction.bind(null, a.id)} defaultValue={a.internalNote ?? ""} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
