import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listAppointments, type ApptRow } from "@/server/modules/booking/queries";
import { expireOverduePendings } from "@/server/modules/booking/service";
import { listStaff, getStaffDetail } from "@/server/modules/business/staff";
import { getExceptionMap, getWeeklyHours } from "@/server/modules/business/hours";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { minuteToDate, clipToDay, rangesToIntervals } from "@/lib/availability";
import { rangesForDay, WEEKDAYS, fromMinutes } from "@/lib/schedule";
import { addDaysStr, formatDateStr, todayTR } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata = { title: "Takvim" };

type View = "gun" | "hafta" | "ay";
const fmtTime = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
const fmtDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" });
const weekdayOf = (d: string) => {
  const w = new Date(`${d}T12:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "border-amber-400 bg-amber-50 text-amber-900 border-dashed",
  CONFIRMED: "border-stone-800 bg-white text-stone-900",
  COMPLETED: "border-emerald-500 bg-emerald-50 text-emerald-900",
  NO_SHOW: "border-red-400 bg-red-50 text-red-900",
};

function href(view: View, date: string, staff?: string) {
  const u = new URLSearchParams({ gorunum: view, tarih: date });
  if (staff) u.set("calisan", staff);
  return `/isletme/panel/takvim?${u}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ gorunum?: string; tarih?: string; calisan?: string }> }) {
  const ctx = await requireBusinessPage();
  await expireOverduePendings(db, { businessId: ctx.businessId });
  const sp = await searchParams;
  const view: View = sp.gorunum === "hafta" || sp.gorunum === "ay" ? sp.gorunum : "gun";
  const today = todayTR();
  const date = sp.tarih && /^\d{4}-\d{2}-\d{2}$/.test(sp.tarih) ? sp.tarih : today;
  const allStaff = (await listStaff(db, ctx.businessId)).filter((s) => s.isActive);
  const staffId = allStaff.some((s) => s.id === sp.calisan) ? sp.calisan : undefined;
  const staff = staffId ? allStaff.filter((s) => s.id === staffId) : allStaff;

  // Görünüm aralığı
  let from = date;
  let days = 1;
  if (view === "hafta") {
    from = addDaysStr(date, -(weekdayOf(date) - 1));
    days = 7;
  } else if (view === "ay") {
    const first = `${date.slice(0, 8)}01`;
    from = addDaysStr(first, -(weekdayOf(first) - 1));
    days = 42;
  }
  const rows = (await listAppointments(db, ctx.businessId, { from: minuteToDate(from, 0), to: minuteToDate(addDaysStr(from, days), 0) }, { staffId })).filter((r) => r.status !== "CANCELLED");
  const step = view === "gun" ? 1 : view === "hafta" ? 7 : 31;
  const prev = view === "ay" ? `${addDaysStr(`${date.slice(0, 8)}01`, -1).slice(0, 8)}01` : addDaysStr(date, -step);
  const next = view === "ay" ? addDaysStr(`${date.slice(0, 8)}01`, 32).slice(0, 8) + "01" : addDaysStr(date, step);
  const title =
    view === "gun"
      ? formatDateStr(date)
      : view === "hafta"
        ? `${formatDateStr(from)} – ${formatDateStr(addDaysStr(from, 6))}`
        : new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

  return (
    <>
      <PageHeader
        title="Takvim"
        actions={
          <ButtonLink href={`/isletme/panel/randevular/yeni?tarih=${date}${staffId ? `&calisan=${staffId}` : ""}`}>
            <CalendarPlus className="size-4" aria-hidden /> Yeni randevu
          </ButtonLink>
        }
      />
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1">
          <Link href={href(view, prev, staffId)} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Önceki">
            <ChevronLeft className="size-4" />
          </Link>
          <Link href={href(view, today, staffId)} className="rounded-xl px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100">
            Bugün
          </Link>
          <Link href={href(view, next, staffId)} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Sonraki">
            <ChevronRight className="size-4" />
          </Link>
          <span className="ml-2 font-medium text-stone-900">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-stone-100 p-0.5 text-sm">
            {(["gun", "hafta", "ay"] as const).map((v) => (
              <Link key={v} href={href(v, date, staffId)} aria-current={view === v ? "page" : undefined} className={cn("rounded-lg px-3 py-1", view === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-600")}>
                {v === "gun" ? "Gün" : v === "hafta" ? "Hafta" : "Ay"}
              </Link>
            ))}
          </div>
          <form className="flex items-center gap-2">
            <input type="hidden" name="gorunum" value={view} />
            <input type="hidden" name="tarih" value={date} />
            <select name="calisan" defaultValue={staffId ?? ""} className="h-9 rounded-xl border border-stone-200 bg-white px-2 text-sm" aria-label="Çalışan">
              <option value="">Tüm çalışanlar</option>
              {allStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-xl border border-stone-200 px-3 text-sm hover:bg-stone-50">
              Göster
            </button>
          </form>
        </div>
      </Card>

      {staff.length === 0 ? (
        <Card>
          <EmptyState title="Aktif çalışan yok" description="Takvimi görmek için çalışan ekleyin." action={<ButtonLink href="/isletme/panel/calisanlar">Çalışanlar</ButtonLink>} />
        </Card>
      ) : view === "gun" ? (
        <DayView businessId={ctx.businessId} date={date} staff={staff} rows={rows} />
      ) : view === "hafta" ? (
        <WeekView from={from} rows={rows} today={today} staffId={staffId} />
      ) : (
        <MonthView from={from} month={date.slice(0, 7)} rows={rows} today={today} staffId={staffId} />
      )}
    </>
  );
}

async function DayView({ businessId, date, staff, rows }: { businessId: string; date: string; staff: { id: string; name: string }[]; rows: ApptRow[] }) {
  const wd = weekdayOf(date);
  const weekly = await getWeeklyHours(db, businessId);
  const ex = await getExceptionMap(db, businessId, date, date);
  const open = rangesToIntervals(rangesForDay({ weekly, exceptions: ex, tempClosedUntil: null }, date, wd));
  const details = await Promise.all(staff.map((s) => getStaffDetail(db, businessId, s.id)));
  const shiftIv = details.map((d) => rangesToIntervals(d.shifts[wd] ?? []));
  const all = [...open, ...shiftIv.flat(), ...rows.map((r) => clipToDay(date, r.startsAt, r.endsAt)!).filter(Boolean)];
  const start = Math.max(0, Math.floor(Math.min(8 * 60, ...all.map((x) => x[0])) / 60) * 60);
  const end = Math.min(1440, Math.ceil(Math.max(20 * 60, ...all.map((x) => x[1])) / 60) * 60);
  const PX = 1.4; // dakika başına piksel
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);
  const closedDay = open.length === 0;

  return (
    <Card className="overflow-hidden">
      {closedDay && <p className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-sm text-stone-500">İşletme bu gün kapalı.</p>}
      <div className="overflow-x-auto">
        <div className="flex min-w-full">
          <div className="sticky left-0 z-10 w-14 shrink-0 border-r border-stone-100 bg-white pt-10">
            {/* Etiketler mutlak konumlu: çizgilerle aynı hizada kalır (birikimli kayma olmaz) */}
            <div className="relative" style={{ height: (end - start) * PX }}>
              {hours.map((h) => (
                <div key={h} style={{ top: (h - start) * PX }} className="absolute inset-x-0 -translate-y-1/2 pr-2 text-right text-xs tabular-nums text-stone-500 first:translate-y-0">
                  {fromMinutes(h)}
                </div>
              ))}
            </div>
          </div>
          {staff.map((s, si) => {
            const d = details[si]!;
            const shifts = shiftIv[si]!;
            const breaks = rangesToIntervals(d.breaks[wd] ?? []);
            const offs = d.timeOff.map((t) => clipToDay(date, t.startsAt, t.endsAt)).filter((x): x is [number, number] => !!x);
            const mine = rows.filter((r) => r.staffId === s.id);
            return (
              <div key={s.id} className="min-w-48 flex-1 border-r border-stone-100 last:border-r-0 sm:min-w-56">
                <div className="flex h-10 items-center border-b border-stone-100 px-3 text-sm font-medium text-stone-800">{s.name}</div>
                <div className="relative" style={{ height: (end - start) * PX }}>
                  {/* çalışılmayan zaman: gri; vardiya: beyaz */}
                  <div className="absolute inset-0 bg-stone-100/70" />
                  {shifts.map(([a, b], i) => (
                    <div key={i} className="absolute inset-x-0 bg-white" style={{ top: (a - start) * PX, height: (b - a) * PX }} />
                  ))}
                  {[...breaks, ...offs].map(([a, b], i) => (
                    <div key={`b${i}`} className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,#f5f5f4,#f5f5f4_6px,#e7e5e4_6px,#e7e5e4_7px)]" style={{ top: (a - start) * PX, height: (b - a) * PX }} title="Mola / izin" />
                  ))}
                  {hours.map((h) => (
                    <div key={h} className="absolute inset-x-0 border-t border-stone-100" style={{ top: (h - start) * PX }} />
                  ))}
                  {mine.map((r) => {
                    const iv = clipToDay(date, r.startsAt, r.endsAt);
                    if (!iv) return null;
                    return (
                      <Link
                        key={r.id}
                        href={`/isletme/panel/randevular/${r.id}`}
                        className={cn("absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-xs shadow-sm hover:z-10 hover:shadow", STATUS_STYLE[r.status])}
                        style={{ top: (iv[0] - start) * PX + 1, height: Math.max(22, (iv[1] - iv[0]) * PX - 2) }}
                      >
                        <span className="font-medium tabular-nums">{fmtTime.format(r.startsAt)}</span> {r.customerName}
                        <span className="block truncate opacity-70">{r.services}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t border-stone-100 px-4 py-2 text-xs text-stone-500">
        <span className="flex items-center gap-1.5"><span className="size-3 rounded border-2 border-dashed border-amber-400 bg-amber-50" /> Onay bekliyor</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded border-l-4 border-stone-800 bg-white" /> Onaylı</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-emerald-100" /> Tamamlandı</span>
        <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-stone-200" /> Çalışma dışı / mola</span>
      </div>
    </Card>
  );
}

function WeekView({ from, rows, today, staffId }: { from: string; rows: ApptRow[]; today: string; staffId?: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(from, i));
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d, i) => {
        const list = rows.filter((r) => fmtDay.format(r.startsAt) === d);
        return (
          <Card key={d} className={cn("min-h-32 p-3", d === today && "border-stone-400")}>
            <Link href={href("gun", d, staffId)} className="mb-2 block text-sm">
              <span className="font-medium text-stone-900">{WEEKDAYS[i]!.short}</span> <span className="text-stone-500">{d.slice(8)}.{d.slice(5, 7)}</span>
            </Link>
            {list.length === 0 ? (
              <p className="text-xs text-stone-500">Randevu yok</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((r) => (
                  <li key={r.id}>
                    <Link href={`/isletme/panel/randevular/${r.id}`} className={cn("block rounded-lg border-l-4 px-2 py-1 text-xs", STATUS_STYLE[r.status])}>
                      <span className="font-medium tabular-nums">{fmtTime.format(r.startsAt)}</span> {r.customerName}
                      <span className="block truncate opacity-70">{r.staffName}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function MonthView({ from, month, rows, today, staffId }: { from: string; month: string; rows: ApptRow[]; today: string; staffId?: string }) {
  const days = Array.from({ length: 42 }, (_, i) => addDaysStr(from, i));
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-stone-100 text-center text-xs text-stone-500">
        {WEEKDAYS.map((w) => (
          <div key={w.value} className="py-2">
            {w.short}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = rows.filter((r) => fmtDay.format(r.startsAt) === d);
          const pending = list.filter((r) => r.status === "PENDING").length;
          return (
            <Link
              key={d}
              href={href("gun", d, staffId)}
              className={cn("min-h-20 border-b border-r border-stone-100 p-2 text-sm hover:bg-stone-50", !d.startsWith(month) && "bg-stone-50/60 text-stone-500")}
            >
              <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs", d === today && "bg-stone-900 text-white")}>{Number(d.slice(8))}</span>
              {list.length > 0 && <span className="mt-1 block text-xs text-stone-700">{list.length} randevu</span>}
              {pending > 0 && <span className="block text-xs text-amber-700">{pending} onay bekliyor</span>}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
