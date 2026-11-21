import { requireCustomerPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { listMyFavorites } from "@/server/modules/customer/account";
import { CardGrid } from "@/components/marketplace/business-card";
import { Card, EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Favorilerim" };

export default async function FavoritesPage() {
  const ctx = await requireCustomerPage("/hesabim/favoriler");
  const favs = await listMyFavorites(db, ctx.customer.id);
  return favs.length === 0 ? (
    <Card>
      <EmptyState title="Henüz favori berberiniz yok" description="Beğendiğiniz berberlerin profilinde “Favorilere ekle”ye dokunun." action={<ButtonLink href="/ara">Berber bul</ButtonLink>} />
    </Card>
  ) : (
    <CardGrid cards={favs} />
  );
}
