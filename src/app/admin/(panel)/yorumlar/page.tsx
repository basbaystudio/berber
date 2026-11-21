import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listReports } from "@/server/modules/reviews/reviews";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { ResolveForm } from "./form";
import { resolveReportAction } from "./actions";

export const metadata = { title: "Yorum Şikâyetleri" };
const REASON = { SPAM: "Spam / reklam", INSULT: "Hakaret / küfür", MISLEADING: "Yanıltıcı", OTHER: "Diğer" } as const;

export default async function ReportsPage() {
  await requireAdminPage();
  const list = await listReports(db, "OPEN");
  return (
    <>
      <PageHeader title="Yorum şikâyetleri" description="İşletmelerin şikâyet ettiği yorumlar. Kaldırılan yorum profilden ve puan ortalamasından çıkar." />
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Bekleyen şikâyet yok" />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <Card key={r.id} className="grid gap-4 p-5 sm:grid-cols-[1fr_minmax(0,20rem)]">
              <div className="space-y-2 text-sm">
                <p>
                  <Link href={`/admin/isletmeler/${r.businessId}`} className="font-medium text-stone-900 hover:text-accent-600">
                    {r.businessName}
                  </Link>
                  <span className="text-stone-500"> · {REASON[r.reason]} · {formatDateTime(r.createdAt)}</span>
                </p>
                {r.note && <p className="text-stone-600">İşletmenin açıklaması: {r.note}</p>}
                <div className="rounded-2xl bg-stone-50 p-3">
                  <p className="text-stone-500">
                    {r.customerName ?? "Müşteri"} · <span className="text-accent-600">{"★".repeat(r.rating)}</span> · {formatDateTime(r.reviewCreatedAt)}
                  </p>
                  {r.comment ? <p className="mt-1 whitespace-pre-line text-stone-800">{r.comment}</p> : <p className="mt-1 text-stone-500">Yorum metni yok (yalnızca puan).</p>}
                  {r.reply && <p className="mt-2 text-xs text-stone-500">İşletme yanıtı: {r.reply}</p>}
                </div>
              </div>
              <ResolveForm action={resolveReportAction.bind(null, r.id)} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
