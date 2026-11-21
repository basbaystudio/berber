import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listBusinesses } from "@/server/modules/admin/businesses";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Button, ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/time";
import { StatusBadge } from "./status-badge";

export const metadata = { title: "İşletmeler" };

const STATUSES = { ACTIVE: "Aktif", DRAFT: "Taslak", SUSPENDED: "Askıda" } as const;

export default async function BusinessesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const status = sp.durum && sp.durum in STATUSES ? (sp.durum as keyof typeof STATUSES) : undefined;
  const page = Math.max(1, Number(sp.sayfa) || 1);
  const { rows, total, pageSize } = await listBusinesses(db, { q, status, page });
  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("durum", status);
    if (p > 1) u.set("sayfa", String(p));
    const s = u.toString();
    return `/admin/isletmeler${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="İşletmeler" description="Platformdaki tüm berber işletmeleri" actions={<ButtonLink href="/admin/isletmeler/yeni">Yeni işletme</ButtonLink>} />
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-stone-100 p-4" role="search">
          <label className="relative min-w-0 flex-1 basis-60">
            <span className="sr-only">Ara</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -transtone-y-1/2 text-stone-400" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="İşletme adı, bağlantı adı veya kullanıcı adı"
              className="h-10 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm focus:border-stone-400 focus:outline-none focus:ring-4 focus:ring-stone-200/60"
            />
          </label>
          <label>
            <span className="sr-only">Durum</span>
            <select name="durum" defaultValue={status ?? ""} className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm">
              <option value="">Tüm durumlar</option>
              {Object.entries(STATUSES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline">
            Filtrele
          </Button>
          {(q || status) && (
            <ButtonLink href="/admin/isletmeler" variant="ghost">
              Temizle
            </ButtonLink>
          )}
        </form>

        {rows.length === 0 ? (
          q || status ? (
            <EmptyState title="Sonuç bulunamadı" description="Arama veya filtre kriterlerini değiştirip tekrar deneyin." />
          ) : (
            <EmptyState
              title="Henüz işletme yok"
              description="Berberler kendileri kayıt olamaz; işletmeleri ve giriş bilgilerini siz oluşturursunuz."
              action={<ButtonLink href="/admin/isletmeler/yeni">İlk işletmeyi oluştur</ButtonLink>}
            />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">İşletme</th>
                    <th className="px-4 py-3 font-medium">Konum</th>
                    <th className="px-4 py-3 font-medium">Kullanıcı adı</th>
                    <th className="px-4 py-3 font-medium">Durum</th>
                    <th className="px-4 py-3 font-medium">Güven</th>
                    <th className="px-4 py-3 font-medium">Son giriş</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {rows.map((b) => (
                    <tr key={b.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/isletmeler/${b.id}`} className="font-medium text-stone-900 hover:text-accent-600">
                          {b.name}
                        </Link>
                        <p className="text-xs text-stone-500">/berber/{b.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {b.district}, {b.province}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-stone-600">{b.login ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={b.status} published={b.isPublished} reason={b.suspendedReason} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-stone-600">{b.trustScore != null ? Math.round(Number(b.trustScore)) : "—"}</td>
                      <td className="px-4 py-3 text-stone-600">{b.lastLoginAt ? formatDateTime(b.lastLoginAt) : "Hiç giriş yapmadı"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-stone-100 md:hidden">
              {rows.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/isletmeler/${b.id}`} className="block space-y-1 px-4 py-3 hover:bg-stone-50">
                    <p className="font-medium text-stone-900">{b.name}</p>
                    <p className="text-sm text-stone-500">
                      {b.district}, {b.province}
                    </p>
                    <StatusBadge status={b.status} published={b.isPublished} reason={b.suspendedReason} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={hrefFor} />
      </Card>
    </>
  );
}
