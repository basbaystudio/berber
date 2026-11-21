import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getMyContracts } from "@/server/modules/business/contracts";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { AcceptForm } from "./form";
import { acceptContractAction } from "./actions";

export const metadata = { title: "Sözleşmeler" };

export default async function ContractsPage() {
  const ctx = await requireBusinessPage();
  const list = await getMyContracts(db, ctx.businessId);
  return (
    <>
      <PageHeader title="Sözleşmeler" description="Platform sözleşmelerinin güncel sürümleri. Güncellenen sözleşmeleri inceleyip onaylamanız gerekir." />
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Yayınlanmış sözleşme yok" />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <Card key={c.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-900">{c.title}</p>
                  <p className="text-sm text-stone-500">
                    Sürüm {c.version} · {formatDateTime(c.published_at)}
                    {c.change_note ? ` · ${c.change_note}` : ""}
                  </p>
                </div>
                {c.acceptedAt ? <Badge tone="green">Onaylandı · {formatDateTime(c.acceptedAt)}</Badge> : <Badge tone="amber">Onayınız bekleniyor</Badge>}
              </div>
              <details className="mt-4" open={!c.acceptedAt}>
                <summary className="cursor-pointer text-sm text-stone-600 hover:text-stone-900">Metni göster</summary>
                <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-line rounded-2xl border border-stone-200/80 bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
                  {c.content}
                </div>
              </details>
              {!c.acceptedAt && (
                <div className="mt-4">
                  <AcceptForm action={acceptContractAction.bind(null, c.id)} title={c.title} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
