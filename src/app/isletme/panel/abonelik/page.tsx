import { CreditCard, FileText } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getMyBilling } from "@/server/modules/business/billing";
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatTL } from "@/lib/money";
import { formatDateStr } from "@/lib/dates";
import { formatDateTime } from "@/lib/time";
import { MethodForm } from "./forms";
import { cardSetupAction, setMethodAction } from "./actions";

export const metadata = { title: "Abonelik" };

const METHOD = { CARD: "Kart", BANK_TRANSFER: "Havale/EFT", CASH: "Nakit", OTHER: "Diğer" } as const;

export default async function BillingPage() {
  const ctx = await requireBusinessPage();
  const b = await getMyBilling(db, ctx.businessId);
  const st = b.status;
  const method = b.sub.preferredMethod as "CARD" | "BANK_TRANSFER";
  return (
    <>
      <PageHeader title="Abonelik" description="Paketiniz, ödeme yönteminiz ve faturalarınız." />
      {st.kind === "PAST_DUE" && (
        <Alert tone="warning" className="mb-6" title="Ödemeniz gecikti">
          Gecikme süresi dolduğunda işletmeniz otomatik olarak askıya alınır. Lütfen ödemenizi yapın.
        </Alert>
      )}
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={b.plan.name} description={`${formatTL(b.sub.monthlyFeeKurus)} / ay`} actions={<Badge tone={st.kind === "PAST_DUE" ? "red" : st.kind === "PAID" ? "green" : "gray"}>{st.label}</Badge>} />
          <div className="space-y-2 p-6 text-sm text-stone-600">
            {st.kind === "FREE_PERIOD" && <p>Şu an ücretsiz dönemdesiniz; ödeme alınmıyor. {b.sub.trialMonths} aylık ücretsiz deneme süreniz, ücretlendirme başladığında işlemeye başlayacak.</p>}
            {st.kind === "TRIAL" && <p>Ücretsiz deneme süreniz {formatDateStr(st.coveredUntil)} tarihinde bitiyor ({st.days} gün kaldı).</p>}
            {st.kind === "PAID" && <p>Aboneliğiniz {formatDateStr(st.coveredUntil)} tarihine kadar ödendi.</p>}
            {st.kind === "PAST_DUE" && <p>Son ödenen gün: {formatDateStr(st.coveredUntil)} ({st.days} gün gecikme).</p>}
            {b.plan.highlights.length > 0 && (
              <ul className="list-inside list-disc pt-2 text-stone-500">
                {b.plan.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Kart" description="Kart bilgileriniz ödeme kuruluşunda saklanır; bizim sistemimizde tutulmaz." />
          <div className="space-y-4 p-6 text-sm">
            {b.sub.cardLast4 ? (
              <p className="flex items-center gap-2 text-stone-900">
                <CreditCard className="size-4 text-stone-400" aria-hidden />
                {b.sub.cardBrand ?? "Kart"} •••• {b.sub.cardLast4}
                {b.sub.autoRenew ? <Badge tone="green">Otomatik ödeme açık</Badge> : <Badge>Otomatik ödeme kapalı</Badge>}
              </p>
            ) : (
              <p className="text-stone-500">Tanımlı kart yok.</p>
            )}
            {b.cardPaymentsAvailable ? (
              <ActionButton action={cardSetupAction} variant="primary" pendingText="Yönlendiriliyor…">
                {b.sub.cardLast4 ? "Kartı değiştir" : "Kart tanımla"}
              </ActionButton>
            ) : (
              <Alert tone="info">Kartla ödeme henüz aktif değil. Ücretlendirme başladığında buradan kartınızı tanımlayabilir ve değiştirebilirsiniz.</Alert>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader title="Ödeme yöntemi" />
        <div className="space-y-4 p-6">
          <MethodForm action={setMethodAction} current={method} />
          {method === "BANK_TRANSFER" && (
            <div className="rounded-2xl bg-stone-50 p-4 text-sm">
              {b.bank.iban ? (
                <dl className="grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-4">
                  {b.bank.bankName && (
                    <>
                      <dt className="text-stone-500">Banka</dt>
                      <dd className="text-stone-900">{b.bank.bankName}</dd>
                    </>
                  )}
                  {b.bank.accountName && (
                    <>
                      <dt className="text-stone-500">Hesap sahibi</dt>
                      <dd className="text-stone-900">{b.bank.accountName}</dd>
                    </>
                  )}
                  <dt className="text-stone-500">IBAN</dt>
                  <dd className="font-mono text-stone-900">{b.bank.iban.replace(/(.{4})/g, "$1 ").trim()}</dd>
                  <dt className="text-stone-500">Açıklama</dt>
                  <dd className="text-stone-900">{ctx.business.name} abonelik</dd>
                </dl>
              ) : (
                <p className="text-stone-500">Banka bilgileri için platform yönetimiyle iletişime geçin.</p>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Ödemeler ve faturalar" />
        {b.payments.length === 0 ? (
          <EmptyState title="Henüz ödeme yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {b.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                <div>
                  <p className="font-medium text-stone-900">
                    {formatTL(p.amountKurus)} · {p.months} ay · {METHOD[p.method]}
                  </p>
                  <p className="text-stone-500">
                    {formatDateStr(p.coversFrom)} – {formatDateStr(p.coversTo)} · {formatDateTime(p.paidAt)}
                  </p>
                </div>
                {p.hasInvoice ? (
                  <a href={`/isletme/panel/abonelik/fatura/${p.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-stone-900 underline underline-offset-4">
                    <FileText className="size-4" aria-hidden /> Faturayı görüntüle (PDF)
                  </a>
                ) : (
                  <span className="text-stone-400">Fatura hazırlanıyor</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
