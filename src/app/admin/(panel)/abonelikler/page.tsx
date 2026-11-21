import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getBillingOverview, listPlans, listSubscriptions } from "@/server/modules/billing/subscriptions";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatTL } from "@/lib/money";
import { formatDateStr } from "@/lib/dates";
import { CampaignForm, PlanForm } from "./forms";
import { SubscriptionBadge } from "./status-badge";
import {
  createPlanAction,
  disableBillingAction,
  enableBillingAction,
  setDefaultPlanAction,
  updateCampaignAction,
  updatePlanAction,
} from "./actions";

export const metadata = { title: "Abonelikler" };

export default async function SubscriptionsPage() {
  await requireAdminPage();
  const [overview, plans, subs] = [await getBillingOverview(db), await listPlans(db), await listSubscriptions(db)];
  const pastDue = subs.filter((s) => s.status.kind === "PAST_DUE").length;

  return (
    <>
      <PageHeader title="Abonelikler" description="Paketler, kampanya kuralları ve işletmelerin abonelik durumu." />

      <Card className="mb-6">
        <CardHeader
          title="Ücretlendirme"
          description={
            overview.billing.enabled
              ? `Açık · ${formatDateStr(overview.billing.liveSince)} tarihinden beri`
              : "Kapalı · Deneme dönemi: tüm işletmeler ücretsiz, kart bilgisi istenmez."
          }
          actions={overview.billing.enabled ? <Badge tone="green">Açık</Badge> : <Badge>Kapalı</Badge>}
        />
        <div className="space-y-3 p-6">
          {overview.billing.enabled ? (
            <>
              <p className="text-sm text-stone-600">Durdurursanız tüm işletmeler yeniden ücretsiz görünür; deneme ve ödeme tarihleri korunur.</p>
              <ActionButton action={disableBillingAction} variant="dangerOutline" confirm="Ücretlendirme durdurulacak. Emin misiniz?">
                Ücretlendirmeyi durdur
              </ActionButton>
            </>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                Başlattığınız gün, mevcut işletmelerin ücretsiz deneme süresi (kampanyalılar için {overview.early.trialMonths} ay, diğerleri için{" "}
                {overview.defaultTrial} ay) işlemeye başlar. Bu tarihten sonra eklenen işletmelerin süresi eklendikleri gün başlar.
              </p>
              <ActionButton
                action={enableBillingAction}
                variant="primary"
                confirm="Ücretlendirme başlatılacak ve tüm işletmelerin deneme süreleri bugünden itibaren işlemeye başlayacak. Emin misiniz?"
              >
                Ücretlendirmeyi başlat
              </ActionButton>
            </>
          )}
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Kampanya"
            description={`İlk ${overview.early.limit} işletme ${overview.early.trialMonths} ay, sonrakiler ${overview.defaultTrial} ay ücretsiz. Kullanılan: ${overview.earlyUsed}/${overview.early.limit}`}
          />
          <div className="p-6">
            <CampaignForm
              action={updateCampaignAction}
              defaults={{ earlyLimit: overview.early.limit, earlyTrialMonths: overview.early.trialMonths, defaultTrialMonths: overview.defaultTrial }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Yeni paket" description="Örn. Premium Plus. Mevcut işletmeler etkilenmez; işletme detayından pakete geçirilebilir." />
          <div className="p-6">
            <PlanForm action={createPlanAction} />
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Paketler" description="Varsayılan paket yeni oluşturulan işletmelere atanır." />
        <ul className="divide-y divide-stone-100">
          {plans.map((p) => (
            <li key={p.id} className="space-y-4 px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-stone-900">{p.name}</p>
                  <span className="text-sm text-stone-500">{formatTL(p.monthlyPriceKurus)} / ay</span>
                  {p.isDefault && <Badge tone="blue">Varsayılan</Badge>}
                  {!p.isActive && <Badge>Pasif</Badge>}
                </div>
                {!p.isDefault && p.isActive && (
                  <ActionButton action={setDefaultPlanAction.bind(null, p.id)}>Varsayılan yap</ActionButton>
                )}
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm text-stone-500 hover:text-stone-900">Düzenle</summary>
                <div className="mt-4">
                  <PlanForm
                    action={updatePlanAction.bind(null, p.id)}
                    defaults={{
                      name: p.name,
                      code: p.code,
                      description: p.description,
                      monthlyPriceKurus: p.monthlyPriceKurus,
                      highlights: p.highlights,
                      isActive: p.isActive,
                      sortOrder: p.sortOrder,
                    }}
                  />
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="İşletme abonelikleri" description={pastDue ? `${pastDue} işletmenin ödemesi gecikmiş.` : undefined} />
        {pastDue > 0 && (
          <div className="px-6 pt-4">
            <Alert tone="warning">Ödemesi geciken işletmeler otomatik askıya alınmaz; gerekirse işletme detayından askıya alabilirsiniz.</Alert>
          </div>
        )}
        {subs.length === 0 ? (
          <EmptyState title="Henüz abonelik yok" description="İşletme oluşturduğunuzda varsayılan paketle abonelik otomatik açılır." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-6 py-3 font-medium">İşletme</th>
                  <th className="px-6 py-3 font-medium">Paket</th>
                  <th className="px-6 py-3 font-medium">Aylık</th>
                  <th className="px-6 py-3 font-medium">Durum</th>
                  <th className="px-6 py-3 font-medium">Kapsanan son gün</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {subs.map((s) => (
                  <tr key={s.sub.id}>
                    <td className="px-6 py-3">
                      <Link href={`/admin/isletmeler/${s.sub.businessId}`} className="font-medium text-stone-900 hover:text-accent-600">
                        {s.businessName}
                      </Link>
                      {s.sub.isEarlyAdopter && <span className="ml-2 text-xs text-accent-600">Kampanyalı</span>}
                    </td>
                    <td className="px-6 py-3 text-stone-600">{s.plan.name}</td>
                    <td className="px-6 py-3 text-stone-600">{formatTL(s.sub.monthlyFeeKurus)}</td>
                    <td className="px-6 py-3">
                      <SubscriptionBadge status={s.status} />
                    </td>
                    <td className="px-6 py-3 text-stone-600">
                      {s.status.coveredUntil ? formatDateStr(s.status.coveredUntil) : `${s.sub.trialMonths} ay deneme (başlamadı)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
