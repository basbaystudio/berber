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

export const metadata = { title: "Genel Bakış" };

const LINKS: Record<string, string> = {
  hours: "/isletme/panel/calisma-saatleri",
  staff: "/isletme/panel/calisanlar",
  services: "/isletme/panel/hizmetler",
};

export default async function BusinessHome({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  const ctx = await requireBusinessPage();
  const sp = await searchParams;
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
                      ? `${formatTL(sub.sub.monthlyFeeKurus)} / ay · ${formatDateStr(sub.status.coveredUntil)} tarihine kadar ödendi`
                      : `${formatTL(sub.sub.monthlyFeeKurus)} / ay · ödeme bekleniyor`}
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
