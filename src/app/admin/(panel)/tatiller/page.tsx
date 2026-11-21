import { requireAdminPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listHolidays } from "@/server/modules/admin/holidays";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ActionButton } from "@/components/ui/action-button";
import { formatDateStr } from "@/lib/dates";
import { HolidayForm } from "./form";
import { deleteHolidayAction, upsertHolidayAction } from "./actions";

export const metadata = { title: "Resmî Tatiller" };

export default async function HolidaysPage() {
  await requireAdminPage();
  const list = await listHolidays(db);
  return (
    <>
      <PageHeader
        title="Resmî tatiller"
        description="İşletmeler bu günleri çalışma saatleri ekranında görür ve tek tıkla kapalı işaretleyebilir. Dini bayramların tarihleri her yıl değiştiği için buradan eklenmelidir."
      />
      <Card className="mb-6">
        <CardHeader title="Tatil ekle" />
        <div className="p-6">
          <HolidayForm action={upsertHolidayAction} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Yaklaşan tatiller" />
        {list.length === 0 ? (
          <EmptyState title="Yaklaşan tatil yok" />
        ) : (
          <ul className="divide-y divide-stone-100">
            {list.map((h) => (
              <li key={h.date} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                <div>
                  <p className="font-medium text-stone-900">
                    {h.name} {h.isHalfDay && <Badge tone="amber">Yarım gün</Badge>}
                  </p>
                  <p className="text-stone-500">{formatDateStr(h.date)}</p>
                </div>
                <ActionButton action={deleteHolidayAction.bind(null, h.date)} variant="ghost" confirm={`${h.name} silinsin mi?`}>
                  Sil
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
