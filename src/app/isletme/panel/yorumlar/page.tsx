import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listBusinessReviews } from "@/server/modules/reviews/reviews";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { ReplyForm, ReportForm } from "./forms";
import { replyAction, reportAction } from "./actions";

export const metadata = { title: "Yorumlar" };

export default async function ReviewsPage() {
  const ctx = await requireBusinessPage();
  const list = await listBusinessReviews(db, ctx.businessId);
  return (
    <>
      <PageHeader title="Yorumlar" description="Müşterilerinizin yorumlarına yanıt verebilirsiniz. Yorumları gizleyemezsiniz; uygunsuz bulduğunuz yorumu platform yönetimine şikâyet edebilirsiniz." />
      {list.length === 0 ? (
        <Card>
          <EmptyState title="Henüz yorum yok" description="Tamamlanan randevulardan sonra müşterileriniz yorum yapabilir." />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-stone-900">
                  {r.customerName ?? "Müşteri"} <span className="text-accent-600">{"★".repeat(r.rating)}</span>
                  {r.staffName && <span className="text-stone-400"> · {r.staffName}</span>}
                </span>
                <span className="flex items-center gap-2 text-stone-400">
                  {r.status === "REMOVED" && <Badge tone="red">Kaldırıldı</Badge>}
                  {r.openReport && <Badge tone="amber">Şikâyet incelemede</Badge>}
                  {formatDateTime(r.createdAt)}
                </span>
              </div>
              {r.comment && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{r.comment}</p>}
              {r.status === "VISIBLE" && (
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
                  <ReplyForm action={replyAction.bind(null, r.id)} defaultValue={r.reply ?? ""} />
                  {!r.openReport && <ReportForm action={reportAction.bind(null, r.id)} />}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
