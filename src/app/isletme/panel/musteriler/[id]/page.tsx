import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { AppError } from "@/server/lib/errors";
import { getCustomerDetail } from "@/server/modules/business/customers";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { AppointmentStatusBadge } from "@/components/panel/appointment-status";
import { formatTL } from "@/lib/money";
import { formatTrPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";
import { NoteForm } from "../../randevular/[id]/forms";
import { customerNotesAction } from "./actions";

export const metadata = { title: "Müşteri" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBusinessPage();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  let c;
  try {
    c = await getCustomerDetail(db, ctx.businessId, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <>
      <Link href="/isletme/panel/musteriler" className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900">
        <ArrowLeft className="size-4" aria-hidden /> Müşteriler
      </Link>
      <PageHeader
        title={c.displayName}
        description={[c.phone && formatTrPhone(c.phone), c.email, c.customerId ? "Üye" : "Panelden eklendi"].filter(Boolean).join(" · ")}
        actions={<ButtonLink href="/isletme/panel/randevular/yeni">Randevu oluştur</ButtonLink>}
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          ["Ziyaret", String(c.visitCount)],
          ["Toplam harcama", formatTL(c.spentKurus)],
          ["Gelmedi", String(c.noShows)],
        ].map(([k, v]) => (
          <Card key={k} className="p-5">
            <p className="text-sm text-stone-500">{k}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-stone-900">{v}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Randevu geçmişi" />
          {c.history.length === 0 ? (
            <EmptyState title="Randevu yok" />
          ) : (
            <ul className="divide-y divide-stone-100">
              {c.history.map((h) => (
                <li key={h.id}>
                  <Link href={`/isletme/panel/randevular/${h.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block text-stone-900">{formatDateTime(h.startsAt)}</span>
                      <span className="text-stone-500">
                        {h.services} · {h.staffName}
                      </span>
                    </span>
                    <span className="tabular-nums text-stone-600">{formatTL(h.totalKurus)}</span>
                    <AppointmentStatusBadge status={h.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Müşteri notu" description="Yalnızca işletmeniz görür (örn. tercih ettiği kesim)." />
          <div className="p-6">
            <NoteForm action={customerNotesAction.bind(null, c.id)} defaultValue={c.notes ?? ""} />
          </div>
        </Card>
      </div>
    </>
  );
}
