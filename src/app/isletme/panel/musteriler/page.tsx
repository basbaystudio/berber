import Link from "next/link";
import { Search } from "lucide-react";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listBusinessCustomers } from "@/server/modules/business/customers";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { formatTrPhone } from "@/lib/phone";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Müşteriler" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sayfa?: string }> }) {
  const ctx = await requireBusinessPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 60) || undefined;
  const page = Math.max(1, Number(sp.sayfa) || 1);
  const { rows, total, pageSize } = await listBusinessCustomers(db, ctx.businessId, { q, page });
  return (
    <>
      <PageHeader title="Müşteriler" description="Sizden randevu almış ya da panelden eklediğiniz müşteriler. Bilgiler yalnızca işletmenize özeldir." />
      <Card>
        <form className="border-b border-stone-100 p-4" role="search">
          <label className="relative block">
            <span className="sr-only">Müşteri ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden />
            <input name="q" defaultValue={q} placeholder="Ad ya da telefon" className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm focus:border-stone-400 focus:outline-none" />
          </label>
        </form>
        {rows.length === 0 ? (
          <EmptyState title={q ? "Sonuç bulunamadı" : "Henüz müşteri yok"} description={q ? undefined : "İlk randevunuzla birlikte müşterileriniz burada listelenir."} />
        ) : (
          <ul className="divide-y divide-stone-100">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/isletme/panel/musteriler/${c.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm hover:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-stone-900">{c.displayName}</span>
                    <span className="text-stone-500">{c.phone ? formatTrPhone(c.phone) : "Telefon yok"}</span>
                  </span>
                  <span className="text-stone-500">{c.visitCount} ziyaret</span>
                  <span className="hidden text-stone-400 sm:inline">{c.lastVisitAt ? `Son: ${formatDateTime(c.lastVisitAt)}` : ""}</span>
                  {c.customerId ? <Badge tone="blue">Üye</Badge> : <Badge>Panel</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => `/isletme/panel/musteriler?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { sayfa: String(p) } : {}) })}`} />
      </Card>
    </>
  );
}
