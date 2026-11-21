import Link from "next/link";
import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { AUDIT_LABELS, listAuditLogs } from "@/server/modules/admin/audit-logs";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime } from "@/lib/time";

export const metadata = { title: "Denetim Kayıtları" };

const REALM_LABEL = { ADMIN: "Yönetici", BUSINESS: "İşletme", CUSTOMER: "Müşteri" } as const;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<{ sayfa?: string }> }) {
  await requireAdminPage();
  const page = Math.max(1, Number((await searchParams).sayfa) || 1);
  const { rows, total, pageSize } = await listAuditLogs(db, page);
  return (
    <>
      <PageHeader title="Denetim kayıtları" description="Giriş denemeleri ve yönetim işlemlerinin geçmişi." />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Kayıt yok" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-slate-900">
                    {AUDIT_LABELS[r.action] ?? r.action}
                    {r.action === "auth.login_failed" && <span className="ml-2"><Badge tone="amber">Uyarı</Badge></span>}
                  </p>
                  <p className="text-slate-500">
                    {r.actorRealm ? REALM_LABEL[r.actorRealm] : "Sistem"}
                    {r.businessId && r.businessName && (
                      <>
                        {" · "}
                        <Link href={`/admin/isletmeler/${r.businessId}`} className="text-brand-600 hover:underline">
                          {r.businessName}
                        </Link>
                      </>
                    )}
                    {r.ip && <> · IP {r.ip}</>}
                  </p>
                </div>
                <time className="shrink-0 text-slate-500" dateTime={r.createdAt.toISOString()}>
                  {formatDateTime(r.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} pageSize={pageSize} total={total} hrefFor={(p) => `/admin/kayitlar${p > 1 ? `?sayfa=${p}` : ""}`} />
      </Card>
    </>
  );
}
