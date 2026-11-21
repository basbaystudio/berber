import { FileText } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getMyDocuments } from "@/server/modules/business/documents";
import { Alert, Badge, Card, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { DocumentUploadForm } from "./form";
import { uploadDocumentAction } from "./actions";

export const metadata = { title: "Belgelerim" };

const STATUS = {
  PENDING: <Badge tone="amber">İnceleniyor</Badge>,
  APPROVED: <Badge tone="green">Onaylandı</Badge>,
  REJECTED: <Badge tone="red">Reddedildi</Badge>,
};

export default async function DocumentsPage() {
  const ctx = await requireBusinessPage();
  const items = await getMyDocuments(db, ctx.businessId);
  const missing = items.filter((i) => i.type.isRequired && i.doc?.status !== "APPROVED").length;
  return (
    <>
      <PageHeader title="Belgelerim" description="Yasal olarak faaliyet gösterdiğinizi doğrulayan belgeleri yükleyin. Belgeleriniz yalnızca platform yönetimi tarafından görülür." />
      {missing > 0 ? (
        <Alert tone="warning" className="mb-6">
          Zorunlu belgeleriniz onaylanmadan profiliniz yayına alınamaz. ({missing} belge bekleniyor)
        </Alert>
      ) : (
        <Alert tone="success" className="mb-6">
          Zorunlu belgelerinizin tamamı onaylandı.
        </Alert>
      )}
      <div className="space-y-4">
        {items.map(({ type, doc }) => (
          <Card key={type.id} className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-stone-900">
                  {type.name} {type.isRequired ? <span className="text-xs text-stone-500">· Zorunlu</span> : <span className="text-xs text-stone-500">· İsteğe bağlı</span>}
                </p>
                {type.description && <p className="text-sm text-stone-500">{type.description}</p>}
              </div>
              {doc ? STATUS[doc.status] : <Badge>Yüklenmedi</Badge>}
            </div>
            {doc && (
              <div className="mt-3 space-y-2 text-sm">
                <a href={`/isletme/panel/belgeler/dosya/${doc.id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-stone-800 underline underline-offset-4">
                  <FileText className="size-4" aria-hidden /> {doc.fileName}
                </a>
                <p className="text-stone-500">Yüklendi: {formatDateTime(doc.uploadedAt)}</p>
                {doc.status === "REJECTED" && doc.reviewNote && <Alert tone="error">Ret nedeni: {doc.reviewNote}</Alert>}
              </div>
            )}
            <div className="mt-4">
              <p className="mb-2 text-xs text-stone-500">{doc ? "Yeni dosya yüklerseniz belge yeniden incelenir." : "PDF, JPEG veya PNG · en fazla 4 MB"}</p>
              <DocumentUploadForm action={uploadDocumentAction.bind(null, type.id)} label={type.name} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
