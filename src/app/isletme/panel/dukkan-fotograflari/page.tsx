import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { MAX_SHOP_PHOTOS } from "@/server/db/schema";
import { listShopPhotos } from "@/server/modules/shop-photos";
import { Card, PageHeader } from "@/components/ui/feedback";
import { ShopPhotosManager } from "@/components/panel/shop-photos-manager";
import { deleteShopPhotoAction, moveShopPhotoAction, setShopPhotoKindAction, uploadShopPhotoAction } from "./actions";

export const metadata = { title: "Dükkan Fotoğrafları" };

export default async function ShopPhotosPage() {
  const ctx = await requireBusinessPage();
  const photos = await listShopPhotos(db, ctx.businessId);
  return (
    <>
      <PageHeader
        title="Dükkan Fotoğrafları"
        description="Dükkanınızın dış cephesi ve içi profilinizde ayrı bir bölümde gösterilir. Kesim fotoğraflarınızı Portfolyo bölümüne ekleyin."
      />
      <Card className="p-6">
        <ShopPhotosManager
          photos={photos}
          limit={MAX_SHOP_PHOTOS}
          upload={uploadShopPhotoAction}
          remove={deleteShopPhotoAction}
          setKind={setShopPhotoKindAction}
          move={moveShopPhotoAction}
        />
      </Card>
    </>
  );
}
