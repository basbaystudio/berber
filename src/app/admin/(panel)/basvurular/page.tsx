import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { CYCLE_LABEL, METHOD_LABEL, getApplicationOffer, listApplications } from "@/server/modules/applications";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatTrPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { ApplicationActions } from "./application-actions";
import { approveApplicationAction, rejectApplicationAction } from "./actions";

export const metadata = { title: "Başvurular" };

const TABS = [
  ["NEW", "Bekleyen"],
  ["APPROVED", "Onaylanan"],
  ["REJECTED", "Reddedilen"],
] as const;

export default async function ApplicationsPage({ searchParams }: { searchParams: Promise<{ durum?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = TABS.some(([k]) => k === sp.durum) ? (sp.durum as "NEW" | "APPROVED" | "REJECTED") : "NEW";
  const [list, offer] = [await listApplications(db, status), await getApplicationOffer(db)];
  return (
    <>
      <PageHeader
        title="Başvurular"
        description={`Ana sayfadaki "İşletmeni ekle" formundan gelen başvurular. Onaylayınca işletme ve hesabı oluşturulur; ücretsiz süre onay sırasına göre verilir (kampanya kontenjanı: ${offer.early.remaining}/${offer.early.limit} kaldı → şu an onaylanana ${offer.currentFreeMonths} ay).`}
      />
      <nav className="mb-4 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm" aria-label="Başvuru durumu">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`/admin/basvurular?durum=${k}`}
            aria-current={status === k ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5", status === k ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-600")}
          >
            {label}
          </Link>
        ))}
      </nav>
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Başvuru yok" description={status === "NEW" ? "Yeni başvurular burada görünür; ayrıca size e-posta gelir." : undefined} />
        </Card>
      ) : (
        <ul className="space-y-4">
          {list.map(({ a, province, district, planName }) => (
            <li key={a.id}>
              <Card className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-stone-900">{a.businessName}</p>
                    <p className="text-sm text-stone-500">
                      {district}, {province} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">
                      {planName} · {CYCLE_LABEL[a.billingCycle] ?? "Aylık"} · {METHOD_LABEL[a.preferredMethod] ?? "Kart"}
                    </Badge>
                    {a.status === "APPROVED" && <Badge tone="green">Onaylandı</Badge>}
                    {a.status === "REJECTED" && <Badge tone="red">Reddedildi</Badge>}
                  </div>
                </div>
                <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-stone-500">Yetkili</dt>
                  <dd className="text-stone-900">{a.ownerName}</dd>
                  <dt className="text-stone-500">Telefon</dt>
                  <dd>
                    <a href={`tel:${a.phone}`} className="text-stone-900 underline underline-offset-4">
                      {formatTrPhone(a.phone)}
                    </a>
                  </dd>
                  <dt className="text-stone-500">E-posta</dt>
                  <dd className="text-stone-900">{a.email}</dd>
                  <dt className="text-stone-500">Adres</dt>
                  <dd className="text-stone-900">{a.addressLine}</dd>
                  <dt className="text-stone-500">Çalışan sayısı</dt>
                  <dd className="text-stone-900">{a.staffCount}</dd>
                  {a.note && (
                    <>
                      <dt className="text-stone-500">Not</dt>
                      <dd className="whitespace-pre-line text-stone-900">{a.note}</dd>
                    </>
                  )}
                  {a.rejectReason && (
                    <>
                      <dt className="text-stone-500">Red açıklaması</dt>
                      <dd className="text-stone-900">{a.rejectReason}</dd>
                    </>
                  )}
                </dl>
                {a.status === "NEW" && <ApplicationActions approve={approveApplicationAction.bind(null, a.id)} reject={rejectApplicationAction.bind(null, a.id)} />}
                {a.status === "APPROVED" && a.businessId && (
                  <Link href={`/admin/isletmeler/${a.businessId}`} className="text-sm font-medium text-stone-900 underline underline-offset-4">
                    İşletmeye git
                  </Link>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
