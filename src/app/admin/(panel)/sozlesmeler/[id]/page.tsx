import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { contractHistory } from "@/server/modules/business/contracts";
import { versionAcceptance } from "@/server/modules/admin/contracts";
import { AppError } from "@/server/lib/errors";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/time";
import { PublishVersionForm } from "../forms";
import { publishVersionAction } from "../actions";

export const metadata = { title: "Sözleşme" };

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let h;
  try {
    h = await contractHistory(db, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const latest = h.versions[0];
  const acceptance = latest ? await versionAcceptance(db, latest.id) : [];
  return (
    <>
      <Link href="/admin/sozlesmeler" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Sözleşmeler
      </Link>
      <PageHeader title={h.contract.title} description={latest ? `Güncel sürüm: ${latest.version}` : "Henüz yayınlanmadı"} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={latest ? "Güncelle (yeni sürüm)" : "İlk sürümü yayınla"} description="Yayınlanan sürümler değiştirilemez; her güncelleme yeni sürüm olur ve işletmelerden yeniden onay istenir." />
          <div className="p-6">
            <PublishVersionForm action={publishVersionAction.bind(null, id)} defaultContent={latest?.content ?? ""} isFirst={!latest} />
          </div>
        </Card>
        <div className="space-y-6">
          {latest && (
            <Card>
              <CardHeader title={`Sürüm ${latest.version} onayları`} description={`${acceptance.filter((a) => a.acceptedAt).length}/${acceptance.length} işletme`} />
              <ul className="max-h-96 divide-y divide-stone-100 overflow-y-auto">
                {acceptance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm">
                    <Link href={`/admin/isletmeler/${a.id}`} className="truncate text-stone-800 hover:text-accent-600">
                      {a.name}
                    </Link>
                    {a.acceptedAt ? (
                      <span className="shrink-0 text-xs text-stone-500" title={a.ip ?? undefined}>
                        {formatDateTime(a.acceptedAt)}
                      </span>
                    ) : (
                      <Badge tone="amber">Bekliyor</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader title="Sürüm geçmişi" />
            <ul className="divide-y divide-stone-100">
              {h.versions.map((v) => (
                <li key={v.id} className="px-6 py-3 text-sm">
                  <details>
                    <summary className="cursor-pointer text-stone-800">
                      Sürüm {v.version} · {formatDateTime(v.publishedAt)}
                      {v.changeNote ? ` · ${v.changeNote}` : ""}
                    </summary>
                    <div className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-xl bg-stone-50 p-3 text-xs text-stone-600">{v.content}</div>
                  </details>
                </li>
              ))}
              {h.versions.length === 0 && <li className="px-6 py-4 text-sm text-stone-500">Henüz sürüm yok.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
