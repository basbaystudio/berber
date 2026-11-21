import Link from "next/link";
import { requireCustomerPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listMyAppointments } from "@/server/modules/customer/account";
import { Alert, Card, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { AppointmentStatusBadge, CANCEL_REASON } from "@/components/panel/appointment-status";
import { formatDateTime } from "@/lib/time";
import { formatTL } from "@/lib/money";
import { formatTrPhone } from "@/lib/phone";
import { todayTR } from "@/lib/dates";
import { ManageAppointment } from "./client";
import { ReviewForm } from "./review-form";
import { cancelMyAppointmentAction, rescheduleMyAppointmentAction } from "../actions";
import { getPublicSlotsAction } from "../../berber/actions";
import { createReviewAction } from "./review-actions";

export const metadata = { title: "Randevularım" };
const fmtDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });

export default async function MyAppointmentsPage({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const ctx = await requireCustomerPage("/hesabim/randevular");
  const sp = await searchParams;
  const { upcoming, past, cutoffMin } = await listMyAppointments(db, ctx.customer.id);
  const today = todayTR();
  return (
    <div className="space-y-8">
      {sp.yeni && (
        <Alert tone="success" title="Randevu talebiniz alındı">
          İşletme onayladığında size e-posta ile haber vereceğiz. Durumunu buradan takip edebilirsiniz.
        </Alert>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-900">Yaklaşan</h2>
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState title="Yaklaşan randevunuz yok" action={<ButtonLink href="/ara">Berber bul</ButtonLink>} />
          </Card>
        ) : (
          upcoming.map((a) => (
            <Card key={a.id} className={`p-5 ${sp.yeni === a.id ? "border-stone-900" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <Link href={`/berber/${a.businessSlug}`} className="text-base font-semibold text-stone-900 hover:text-accent-600">
                    {a.businessName}
                  </Link>
                  <p className="text-stone-700">{formatDateTime(a.startsAt)}</p>
                  <p className="text-stone-500">
                    {a.services} · {a.staffName} · {formatTL(a.totalKurus)}
                  </p>
                  <a href={`tel:${a.businessPhone}`} className="text-stone-500 hover:text-stone-900">
                    {formatTrPhone(a.businessPhone)}
                  </a>
                </div>
                <AppointmentStatusBadge status={a.status} />
              </div>
              {a.status === "PENDING" && a.confirmDeadline && <p className="mt-2 text-xs text-stone-500">İşletmenin onayı bekleniyor (en geç {formatDateTime(a.confirmDeadline)}).</p>}
              <div className="mt-4">
                {a.canChange ? (
                  <ManageAppointment
                    cancel={cancelMyAppointmentAction.bind(null, a.id)}
                    reschedule={rescheduleMyAppointmentAction.bind(null, a.id)}
                    fetchSlots={getPublicSlotsAction.bind(null, a.businessSlug)}
                    serviceIds={a.packageId ? [] : a.serviceIds}
                    packageId={a.packageId ?? undefined}
                    staffId={a.staffId}
                    today={today}
                    defaultDate={fmtDate.format(a.startsAt)}
                  />
                ) : (
                  <p className="text-xs text-stone-500">Randevuya {Math.round(cutoffMin / 60)} saatten az kaldığı için değişiklik ve iptal için işletmeyi arayın.</p>
                )}
              </div>
            </Card>
          ))
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold text-stone-900">Geçmiş</h2>
        {past.length === 0 ? (
          <p className="text-sm text-stone-500">Geçmiş randevunuz yok.</p>
        ) : (
          past.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                <div>
                  <Link href={`/berber/${a.businessSlug}`} className="font-medium text-stone-900 hover:text-accent-600">
                    {a.businessName}
                  </Link>
                  <p className="text-stone-500">
                    {formatDateTime(a.startsAt)} · {a.services}
                  </p>
                  {a.status === "CANCELLED" && a.cancelReason && (
                    <p className="text-xs text-stone-500">
                      {CANCEL_REASON[a.cancelReason]}
                      {a.cancelNote ? ` · ${a.cancelNote}` : ""}
                    </p>
                  )}
                </div>
                <AppointmentStatusBadge status={a.status} />
              </div>
              {a.reviewRating && <p className="mt-2 text-sm text-accent-600">Yorumunuz: {"★".repeat(a.reviewRating)}</p>}
              {a.canReview && (
                <div className="mt-4 border-t border-stone-100 pt-4">
                  <ReviewForm action={createReviewAction.bind(null, a.id)} />
                </div>
              )}
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
