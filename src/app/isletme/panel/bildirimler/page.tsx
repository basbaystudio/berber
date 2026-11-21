import Link from "next/link";
import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listInbox } from "@/server/modules/business/inbox";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Bildirimler" };

export default async function InboxPage() {
  const ctx = await requireBusinessPage();
  const items = await listInbox(db, ctx.businessId);
  const unread = items.some((i) => !i.readAt);
  return (
    <>
      <PageHeader title="Bildirimler" actions={unread ? <ActionButton action={markAllReadAction}>Tümünü okundu işaretle</ActionButton> : undefined} />
      <Card>
        {items.length === 0 ? (
          <EmptyState title="Bildirim yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {items.map((n) => {
              const inner = (
                <div className="flex gap-3">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent-500")} aria-label={n.readAt ? undefined : "Okunmadı"} />
                  <div className="min-w-0">
                    <p className={cn("text-sm", n.readAt ? "text-stone-600" : "font-medium text-stone-900")}>{n.title}</p>
                    {n.body && <p className="text-sm text-stone-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-stone-400">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link ? (
                    <Link href={n.link} className="block px-6 py-4 hover:bg-stone-50">
                      {inner}
                    </Link>
                  ) : (
                    <div className="px-6 py-4">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
