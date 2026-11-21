import Link from "next/link";
import { FileText } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listDocumentTypes, listDocuments } from "@/server/modules/admin/documents";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { DocumentTypeForm, ReviewForm } from "./forms";
import { reviewDocumentAction, saveDocumentTypeAction } from "./actions";

export const metadata = { title: "Belgeler" };

export default async function DocumentsAdminPage() {
  await requireAdminPage();
  const [pending, types] = [await listDocuments(db, { status: "PENDING" }), await listDocumentTypes(db)];
  return (
    <>
      <PageHeader title="Belgeler" description="İşletmelerin yüklediği yasal belgeler. Zorunlu belgeleri onaylanmayan işletme yayına alınamaz." />
      <Card className="mb-6">
        <CardHeader title="İnceleme bekleyenler" description={pending.length ? `${pending.length} belge` : undefined} />
        {pending.length === 0 ? (
          <EmptyState title="İnceleme bekleyen belge yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {pending.map(({ d, typeName, businessName }) => (
              <li key={d.id} className="grid gap-3 px-6 py-4 sm:grid-cols-[1fr_minmax(0,22rem)]">
                <div className="text-sm">
                  <Link href={`/admin/isletmeler/${d.businessId}`} className="font-medium text-stone-900 hover:text-accent-600">
                    {businessName}
                  </Link>
                  <p className="text-stone-600">{typeName}</p>
                  <a href={`/admin/dosya/belge/${d.id}`} target="_blank" rel="noopener" className="mt-1 inline-flex items-center gap-1.5 text-stone-800 underline underline-offset-4">
                    <FileText className="size-4" aria-hidden /> {d.fileName}
                  </a>
                  <p className="text-xs text-stone-500">{formatDateTime(d.uploadedAt)}</p>
                </div>
                <ReviewForm action={reviewDocumentAction.bind(null, d.id)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="İstenen belge türleri" description="İşletmeler bu belgeleri Belgelerim sayfasından yükler." />
        <div className="space-y-5 p-6">
          {types.map((t) => (
            <DocumentTypeForm key={t.id} action={saveDocumentTypeAction.bind(null, t.id)} defaults={t} />
          ))}
          <div className="border-t border-stone-100 pt-5">
            <p className="mb-2 text-sm font-medium text-stone-700">Yeni belge türü</p>
            <DocumentTypeForm action={saveDocumentTypeAction.bind(null, null)} />
          </div>
        </div>
      </Card>
    </>
  );
}
