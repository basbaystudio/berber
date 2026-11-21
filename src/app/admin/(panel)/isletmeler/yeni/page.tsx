import { requireAdminPage } from "@/server/auth/guards";
import { getLocations } from "@/server/modules/reference/locations";
import { PageHeader } from "@/components/ui/feedback";
import { createBusinessAction } from "../actions";
import { CreateBusinessForm } from "../business-form";

export const metadata = { title: "Yeni İşletme" };

export default async function NewBusinessPage() {
  await requireAdminPage();
  const locations = await getLocations();
  return (
    <>
      <PageHeader title="Yeni işletme" description="İşletme profilini ve işletmenin panel giriş hesabını oluşturun." />
      <CreateBusinessForm action={createBusinessAction} locations={locations} />
    </>
  );
}
