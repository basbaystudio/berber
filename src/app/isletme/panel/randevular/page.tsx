import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listAppointments, listPendingRequests } from "@/server/modules/booking/queries";
import { expireOverduePendings } from "@/server/modules/booking/service";
import { listStaff } from "@/server/modules/business/staff";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { ButtonLink, Button } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/panel/appointment-status";
import { minuteToDate } from "@/lib/availability";
import { addDaysStr, formatDateStr, todayTR } from "@/lib/dates";
import { formatDateTime } from "@/lib/time";
import { formatTL } from "@/lib/money";
import { confirmAction } from "./actions";

export const metadata = { title: "Randevular" };

const fmtTime = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const STATUSES = { PENDING: "Onay bekleyen", CONFIRMED: "Onaylı", COMPLETED: "Tamamlanan", CANCELLED: "İptal", NO_SHOW: "Gelmedi" } as const;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ baslangic?: string; gun?: string; durum?: string; calisan?: string }> }) {
  const ctx = await requireBusinessPage();
  await expireOverduePendings(db, { businessId: ctx.businessId });
  const sp = await searchParams;
  const today = todayTR();
  const from = sp.baslangic && /^\d{4}-\d{2}-\d{2}$/.test(sp.baslangic) ? sp.baslangic : today;
  const days = Math.min(31, Math.max(1, Number(sp.gun) || 7));
  const status = sp.durum && sp.durum in STATUSES ? (sp.durum as keyof typeof STATUSES) : undefined;
  const staff = await listStaff(db, ctx.businessId);
  const staffId = staff.some((s) => s.id === sp.calisan) ? sp.calisan : undefined;
  const [pending, rows] = [
    await listPendingRequests(db, ctx.businessId),
    await listAppointments(db, ctx.businessId, { from: minuteToDate(from, 0), to: minuteToDate(addDaysStr(from, days), 0) }, { staffId, statuses: status ? [status] : undefined }),
  ];
  const byDay = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = fmtDay.format(r.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  }

  return (
    <>
      <PageHeader
        title="Randevular"
        actions={
          <ButtonLink href="/isletme/panel/randevular/yeni">
            <CalendarPlus className="size-4" aria-hidden /> Yeni randevu
          </ButtonLink>
        }
      />
      {pending.length > 0 && (
        <Card className="mb-6 border-amber-200">
          <CardHeader title={`Onay bekleyen talepler (${pending.length})`} description="Süresi içinde onaylanmayan talepler otomatik iptal olur ve güven puanınızı düşürür." />
          <ul className="divide-y divide-stone-100">
            {pending.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                <Link href={`/isletme/panel/randevular/${r.id}`} className="min-w-0">
                  <p className="font-medium text-stone-900">
                    {formatDateTime(r.startsAt)} · {r.customerName}
                  </p>
                  <p className="text-stone-500">
                    {r.services} · {r.staffName} · son onay {r.confirmDeadline ? fmtTime.format(r.confirmDeadline) : "—"}
                  </p>
                </Link>
                <div className="flex gap-2">
                  <ActionButton action={confirmAction.bind(null, r.id)} variant="primary">
                    Onayla
                  </ActionButton>
                  <ButtonLink href={`/isletme/panel/randevular/${r.id}`} variant="outline">
                    Detay
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <form className="flex flex-wrap items-end gap-2 border-b border-stone-100 p-4 text-sm">
          <label className="space-y-1">
            <span className="block text-xs text-stone-500">Başlangıç</span>
            <input type="date" name="baslangic" defaultValue={from} className="h-9 rounded-xl border border-stone-200 px-2" />
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-stone-500">Aralık</span>
            <select name="gun" defaultValue={String(days)} className="h-9 rounded-xl border border-stone-200 bg-white px-2">
              <option value="1">1 gün</option>
              <option value="7">7 gün</option>
              <option value="14">14 gün</option>
              <option value="31">31 gün</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-stone-500">Durum</span>
            <select name="durum" defaultValue={status ?? ""} className="h-9 rounded-xl border border-stone-200 bg-white px-2">
              <option value="">Tümü</option>
              {Object.entries(STATUSES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="block text-xs text-stone-500">Çalışan</span>
            <select name="calisan" defaultValue={staffId ?? ""} className="h-9 rounded-xl border border-stone-200 bg-white px-2">
              <option value="">Tümü</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" size="sm" className="h-9">
            Göster
          </Button>
        </form>
        {rows.length === 0 ? (
          <EmptyState title="Bu aralıkta randevu yok" />
        ) : (
          [...byDay.entries()].map(([day, list]) => (
            <section key={day}>
              <h3 className="bg-stone-50 px-6 py-2 text-xs font-medium uppercase tracking-wide text-stone-500">{formatDateStr(day)}</h3>
              <ul className="divide-y divide-stone-100">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/isletme/panel/randevular/${r.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm hover:bg-stone-50">
                      <span className="w-12 font-medium tabular-nums text-stone-900">{fmtTime.format(r.startsAt)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-stone-900">{r.customerName}</span>
                        <span className="block truncate text-stone-500">
                          {r.services} · {r.staffName}
                        </span>
                      </span>
                      <span className="tabular-nums text-stone-600">{formatTL(r.totalKurus)}</span>
                      <AppointmentStatusBadge status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </Card>
    </>
  );
}
