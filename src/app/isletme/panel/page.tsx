import { CheckCircle2, Circle } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getPublishChecklist } from "@/server/modules/business/publish";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui/feedback";

export const metadata = { title: "Genel Bakış" };

export default async function BusinessHome({ searchParams }: { searchParams: Promise<{ sifre?: string }> }) {
  const ctx = await requireBusinessPage();
  const sp = await searchParams;
  const checklist = await getPublishChecklist(db, ctx.businessId);
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
      <Card>
        <CardHeader
          title="Profilinizin yayına hazırlığı"
          description="Profiliniz aşağıdaki adımlar tamamlandıktan sonra platform yönetimi tarafından yayına alınır."
        />
        <ul className="space-y-3 p-5 text-sm">
          {checklist.map((c) => (
            <li key={c.key} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="size-4 text-emerald-600" aria-label="Tamam" /> : <Circle className="size-4 text-slate-300" aria-label="Eksik" />}
              <span className={c.ok ? "text-slate-700" : "text-slate-500"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
