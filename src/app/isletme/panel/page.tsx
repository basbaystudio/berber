import { currentFee } from "@/server/modules/billing/status";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getPublishChecklist } from "@/server/modules/business/publish";
import { getBusinessOpenState } from "@/server/modules/business/hours";
import { getBusinessSubscription } from "@/server/modules/billing/subscriptions";
import { getPortfolio } from "@/server/modules/business/portfolio";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { formatTL } from "@/lib/money";
import { formatDateStr } from "@/lib/dates";
import { getDashboardMetrics, listAppointments } from "@/server/modules/booking/queries";
import { expireOverduePendings } from "@/server/modules/booking/service";
import { listStaff } from "@/server/modules/business/staff";
import { getTrust } from "@/server/modules/trust/score";
import { TrustCard } from "@/components/panel/trust-card";
import { AppointmentStatusBadge } from "@/components/panel/appointment-status";
import { ButtonLink } from "@/components/ui/button";
import { minuteToDate } from "@/lib/availability";
import { addDaysStr, todayTR } from "@/lib/dates";

export const metadata = { title: "Genel Bakış" };

const LINKS: Record<string, string> = {
  hours: "/isletme/panel/calisma-saatleri",
  staff: "/isletme/panel/calisanlar",
  services: "/isletme/panel/hizmetler",
  documents: "/isletme/panel/belgeler",
  contracts: "/isletme/panel/sozlesmeler",
};

export default async function BusinessHome({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  const ctx = await requireBusinessPage();
  const sp = await searchParams;
  await expireOverduePendings(db, { businessId: ctx.businessId });
  const today = todayTR();
  const [m, todayRows, upcoming, staffList, trust] = [
    await getDashboardMetrics(db, ctx.businessId),
    await listAppointments(db, ctx.businessId, { from: minuteToDate(today, 0), to: minuteToDate(addDaysStr(today, 1), 0) }),
    (await listAppointments(db, ctx.businessId, { from: new Date(), to: minuteToDate(addDaysStr(today, 14), 0) }, { statuses: ["PENDING", "CONFIRMED"] })).slice(0, 6),
    (await listStaff(db, ctx.businessId)).filter((s) => s.isActive),
    await getTrust(db, ctx.businessId),
  ];
  const fmtTime = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const [checklist, open, sub, portfolio] = [
    await getPublishChecklist(db, ctx.businessId),
    await getBusinessOpenState(db, ctx.businessId),
    await getBusinessSubscription(db, ctx.businessId),
    await getPortfolio(db, ctx.businessId),
  ];
  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${ctx.user.name}`}
        description={ctx.business.name}
        actions={ctx.business.isPublished ? <Badge tone="blue">Pazaryerinde yayında</Badge> : <Badge>Henüz yayında değil</Badge>}
      />
      {sp.sifre === "degisti" && (
        <Alert tone="success" className="mb-6">
          Şifreniz değiştirildi. Diğer cihazlardaki oturumlarınız kapatıldı.
        </Alert>
      )}
      {sub?.status.kind === "PAST_DUE" && (
        <Alert tone="warning" className="mb-6" title="Abonelik ödemeniz gecikti">
          Profilinizin kesintisiz yayında kalması için lütfen ödemenizi yapın ya da platform yönetimiyle iletişime geçin.
        </Alert>
      )}

      <section aria-label="Randevu özeti" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Bugünkü randevu", String(m.today), `Beklenen ${formatTL(m.expectedTodayKurus)}`],
          ["Onay bekleyen", String(m.pending), m.pending ? "Süresi dolmadan onaylayın" : "Bekleyen talep yok"],
          ["Bugünkü gelir", formatTL(m.revenueTodayKurus), "Tamamlanan randevular"],
          ["Bu ayki gelir", formatTL(m.revenueMonthKurus), `${m.completed} tamamlandı · ${m.cancelled} iptal`],
        ].map(([k, v, h]) => (
          <Card key={k} className="p-5">
            <p className="text-sm text-stone-500">{k}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">{v}</p>
            <p className="mt-1 text-xs text-stone-500">{h}</p>
          </Card>
        ))}
      </section>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Yaklaşan randevular" actions={<ButtonLink href="/isletme/panel/takvim" variant="ghost" size="sm">Takvim</ButtonLink>} />
          {upcoming.length === 0 ? (
            <p className="px-6 py-5 text-sm text-stone-500">Yaklaşan randevu yok.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {upcoming.map((r) => (
                <li key={r.id}>
                  <Link href={`/isletme/panel/randevular/${r.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-stone-900">
                        {formatDateStr(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(r.startsAt))} · {fmtTime.format(r.startsAt)} · {r.customerName}
                      </span>
                      <span className="text-stone-500">
                        {r.services} · {r.staffName}
                      </span>
                    </span>
                    <AppointmentStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <TrustCard {...trust} />
      </div>

      <Card className="mb-6">
        <CardHeader title="Çalışanların bugünkü durumu" />
        {staffList.length === 0 ? (
          <p className="px-6 py-5 text-sm text-stone-500">Aktif çalışan yok.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {staffList.map((s) => {
              const mine = todayRows.filter((r) => r.staffId === s.id && r.status !== "CANCELLED");
              const current = mine.find((r) => r.startsAt <= now && r.endsAt > now);
              const next = mine.find((r) => r.startsAt > now);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 text-sm">
                  <span className="font-medium text-stone-900">{s.name}</span>
                  <span className="text-stone-500">
                    {mine.length} randevu
                    {current ? ` · şu an: ${current.customerName}` : next ? ` · sıradaki ${fmtTime.format(next.startsAt)}` : " · bugün boş"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-stone-500">Şu anki durum</p>
          <p className="mt-2 flex items-center gap-2 text-xl font-semibold text-stone-900">
            <span className={`size-2 rounded-full ${open.isOpen ? "bg-emerald-500" : "bg-stone-300"}`} aria-hidden />
            {open.label}
          </p>
          {open.detail && <p className="mt-1 text-sm text-stone-500">{open.detail}</p>}
        </Card>
        <Card className="p-6">
          <p className="text-sm text-stone-500">Abonelik</p>
          {sub ? (
            <>
              <p className="mt-2 text-xl font-semibold text-stone-900">{sub.plan.name}</p>
              <p className="mt-1 text-sm text-stone-500">
                {sub.status.kind === "FREE_PERIOD"
                  ? "Ücretsiz dönem — şu an ödeme alınmıyor"
                  : sub.status.kind === "TRIAL"
                    ? `Ücretsiz deneme · ${formatDateStr(sub.status.coveredUntil)} tarihine kadar`
                    : sub.status.kind === "PAID"
                      ? `${formatTL(currentFee(sub.sub).kurus)} / ${currentFee(sub.sub).unit} · ${formatDateStr(sub.status.coveredUntil)} tarihine kadar ödendi`
                      : `${formatTL(currentFee(sub.sub).kurus)} / ${currentFee(sub.sub).unit} · ödeme bekleniyor`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-stone-500">Tanımlı değil</p>
          )}
        </Card>
        <Card className="p-6">
          <p className="text-sm text-stone-500">Portfolyo</p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-stone-900">
            {portfolio.used}/{portfolio.limit}
          </p>
          <Link href="/isletme/panel/portfolyo" className="mt-1 inline-block text-sm text-stone-500 hover:text-stone-900">
            fotoğraf kullanılıyor
          </Link>
        </Card>
      </div>

      <Card>
        <CardHeader title="Profilinizin yayına hazırlığı" description="Adımlar tamamlandığında profiliniz platform yönetimi tarafından yayına alınır." />
        <ul className="divide-y divide-stone-100">
          {checklist.map((c) => (
            <li key={c.key}>
              {LINKS[c.key] && !c.ok ? (
                <Link href={LINKS[c.key]!} className="flex items-center gap-3 px-6 py-3.5 text-sm hover:bg-stone-50">
                  <Circle className="size-4 text-stone-300" aria-label="Eksik" />
                  <span className="flex-1 text-stone-600">{c.label}</span>
                  <ArrowRight className="size-4 text-stone-400" aria-hidden />
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-6 py-3.5 text-sm">
                  {c.ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Tamam" /> : <Circle className="size-4 text-stone-300" aria-label="Eksik" />}
                  <span className={c.ok ? "text-stone-800" : "text-stone-500"}>{c.label}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
