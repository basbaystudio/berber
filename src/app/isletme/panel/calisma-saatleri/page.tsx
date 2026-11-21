import { eq } from "drizzle-orm";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { businessSettings } from "@/server/db/schema";
import { getBusinessOpenState, getExceptionMap, getWeeklyHours, upcomingHolidays } from "@/server/modules/business/hours";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { addDaysStr, formatDateStr, todayTR } from "@/lib/dates";
import { formatDateTime } from "@/lib/time";
import { ExceptionForm, HoursForm, TempCloseForm } from "./forms";
import { addExceptionAction, closeHolidayAction, deleteExceptionAction, reopenAction, saveHoursAction, tempCloseAction } from "./actions";

export const metadata = { title: "Çalışma Saatleri" };

const REASON = { HOLIDAY: "Resmî tatil", SPECIAL: "Özel gün", VACATION: "İzin", OTHER: "Diğer" } as const;

export default async function HoursPage() {
  const ctx = await requireBusinessPage();
  const today = todayTR();
  const [weekly, exceptions, holidays, open, [settings]] = [
    await getWeeklyHours(db, ctx.businessId),
    await getExceptionMap(db, ctx.businessId, today, addDaysStr(today, 365)),
    await upcomingHolidays(db),
    await getBusinessOpenState(db, ctx.businessId),
    await db.select().from(businessSettings).where(eq(businessSettings.businessId, ctx.businessId)),
  ];
  const tempActive = settings?.tempClosedUntil && settings.tempClosedUntil > new Date();

  return (
    <>
      <PageHeader
        title="Çalışma saatleri"
        description="Profiliniz bu saatlere göre otomatik olarak AÇIK veya KAPALI görünür. Çalışanların vardiyaları ayrıca tanımlanır."
        actions={<Badge tone={open.isOpen ? "green" : "gray"}>{open.label + (open.detail ? ` · ${open.detail}` : "")}</Badge>}
      />

      <Card className="mb-6">
        <CardHeader title="Haftalık program" description="Öğle arası gibi durumlar için bir güne birden fazla aralık ekleyebilirsiniz." />
        <div className="p-6">
          <HoursForm action={saveHoursAction} defaultValue={weekly} />
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Özel gün ekle" description="Tatil, izin ya da farklı saatlerde çalışacağınız günler" />
          <div className="p-6">
            <ExceptionForm action={addExceptionAction} today={today} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Yaklaşan özel günler" />
          {Object.keys(exceptions).length === 0 ? (
            <p className="px-6 py-5 text-sm text-stone-500">Tanımlı özel gün yok.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {Object.entries(exceptions).map(([date, e]) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                  <div>
                    <p className="font-medium text-stone-900">{formatDateStr(date)}</p>
                    <p className="text-stone-500">
                      {e.kind === "CLOSED" ? "Kapalı" : e.ranges.map((r) => `${r.start}–${r.end}`).join(", ")} · {REASON[e.reason as keyof typeof REASON]}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </div>
                  <ActionButton action={deleteExceptionAction.bind(null, e.id)} variant="ghost">
                    Kaldır
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
          {holidays.length > 0 && (
            <div className="border-t border-stone-100">
              <p className="px-6 pt-4 text-xs font-medium uppercase tracking-wide text-stone-500">Yaklaşan resmî tatiller</p>
              <ul className="divide-y divide-stone-100">
                {holidays.map((h) => (
                  <li key={h.date} className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
                    <div>
                      <p className="text-stone-800">{h.name}</p>
                      <p className="text-stone-500">{formatDateStr(h.date)}</p>
                    </div>
                    {exceptions[h.date] ? (
                      <Badge>Düzenlendi</Badge>
                    ) : (
                      <ActionButton action={closeHolidayAction.bind(null, h.date, h.name)}>Kapalı işaretle</ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Geçici kapanış" description="Tadilat, hastalık gibi durumlarda belirttiğiniz zamana kadar profiliniz kapalı görünür." />
        <div className="p-6">
          {tempActive ? (
            <div className="space-y-4">
              <Alert tone="warning" title={`${formatDateTime(settings!.tempClosedUntil!)} tarihine kadar kapalı`}>
                {settings!.tempClosedNote}
              </Alert>
              <ActionButton action={reopenAction} variant="primary">
                Şimdi yeniden aç
              </ActionButton>
            </div>
          ) : (
            <TempCloseForm action={tempCloseAction} />
          )}
        </div>
      </Card>
    </>
  );
}
