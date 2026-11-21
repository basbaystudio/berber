import { requireBusinessPage } from "@/server/auth/guards";
import { db } from "@/server/db/client";
import { getPortfolio } from "@/server/modules/business/portfolio";
import { listStaff } from "@/server/modules/business/staff";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/feedback";
import { Categories, PhotoCard, Uploader } from "./portfolio-client";
import {
  createCategoryAction,
  deleteCategoryAction,
  deletePhotoAction,
  movePhotoAction,
  replacePhotoAction,
  updatePhotoMetaAction,
  uploadPhotoAction,
} from "./actions";

export const metadata = { title: "Portfolyo" };

export default async function PortfolioPage() {
  const ctx = await requireBusinessPage();
  const [p, staffList] = [await getPortfolio(db, ctx.businessId), await listStaff(db, ctx.businessId)];
  const staff = staffList.map((s) => ({ id: s.id, name: s.name }));
  const categories = p.categories.map((c) => ({ id: c.id, name: c.name }));
  const pct = Math.round((p.used / p.limit) * 100);

  return (
    <>
      <PageHeader
        title="Portfolyo"
        description="Çalışmalarınızın fotoğrafları profilinizde galeri olarak gösterilir."
        actions={
          <div className="w-48 text-right">
            <p className="text-sm font-medium tabular-nums text-stone-900">
              {p.used}/{p.limit} fotoğraf kullanılıyor
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-200" role="progressbar" aria-valuenow={p.used} aria-valuemax={p.limit} aria-label="Fotoğraf kullanımı">
              <div className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-stone-800"}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        }
      />
      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Fotoğraf yükle" />
          <div className="p-6">
            <Uploader action={uploadPhotoAction} remaining={p.limit - p.used} categories={categories} staff={staff} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Kategoriler" description="Örn. Saç kesimi, Sakal, Renklendirme" />
          <div className="p-6">
            <Categories
              categories={categories}
              create={createCategoryAction}
              remove={Object.fromEntries(categories.map((c) => [c.id, deleteCategoryAction.bind(null, c.id)]))}
            />
          </div>
        </Card>
      </div>
      {p.photos.length === 0 ? (
        <Card>
          <EmptyState title="Henüz fotoğraf yok" description="İşlerinizin fotoğraflarını yükleyerek profilinizi güçlendirin." />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {p.photos.map((ph, i) => (
            <PhotoCard
              key={ph.id}
              photo={ph}
              index={i}
              total={p.photos.length}
              categories={categories}
              staff={staff}
              actions={{
                meta: updatePhotoMetaAction.bind(null, ph.id),
                replace: replacePhotoAction.bind(null, ph.id),
                remove: deletePhotoAction.bind(null, ph.id),
                up: movePhotoAction.bind(null, ph.id, "up"),
                down: movePhotoAction.bind(null, ph.id, "down"),
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}
