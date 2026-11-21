import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listPackages, listServices } from "@/server/modules/business/catalog";
import { listStaff } from "@/server/modules/business/staff";
import { Card, EmptyState, PageHeader } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { todayTR } from "@/lib/dates";
import { NewAppointmentForm } from "./form";
import { createPanelAppointmentAction, getSlotsAction, searchCustomersAction } from "../actions";

export const metadata = { title: "Yeni Randevu" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ tarih?: string; calisan?: string }> }) {
  const ctx = await requireBusinessPage();
  const sp = await searchParams;
  const [services, packages, staff] = [
    (await listServices(db, ctx.businessId)).filter((s) => s.isActive),
    (await listPackages(db, ctx.businessId)).filter((p) => p.isActive),
    (await listStaff(db, ctx.businessId)).filter((s) => s.isActive),
  ];
  const today = todayTR();
  const date = sp.tarih && /^\d{4}-\d{2}-\d{2}$/.test(sp.tarih) && sp.tarih >= today ? sp.tarih : today;
  return (
    <>
      <PageHeader title="Yeni randevu" description="Telefonla arayan ya da kapıdan gelen müşteriler için. Panelden oluşturulan randevu doğrudan onaylıdır." />
      <Card className="p-6">
        {services.length === 0 || staff.length === 0 ? (
          <EmptyState
            title="Önce hizmet ve çalışan ekleyin"
            description="Randevu oluşturmak için en az bir aktif hizmet ve o hizmeti veren bir çalışan gerekir."
            action={<ButtonLink href="/isletme/panel/hizmetler">Hizmetlere git</ButtonLink>}
          />
        ) : (
          <NewAppointmentForm
            action={createPanelAppointmentAction}
            fetchSlots={getSlotsAction}
            search={searchCustomersAction}
            services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceKurus: s.priceKurus, staffIds: s.staffIds }))}
            packages={packages.map((p) => ({ id: p.id, name: p.name, durationMin: p.durationMin, priceKurus: p.priceKurus, staffIds: p.staffIds }))}
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            today={today}
            defaultDate={date}
            defaultStaffId={sp.calisan}
          />
        )}
      </Card>
    </>
  );
}
